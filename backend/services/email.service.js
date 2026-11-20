'use strict';
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { renderTemplate } = require('./email-templates');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Error classification helpers
// ---------------------------------------------------------------------------

/**
 * SMTP error codes / messages that mean the server definitively rejected us.
 *
 * "Definitive" = server confirmed it will NOT deliver the message.
 *   → Safe to fall back to secondary provider.
 *
 * "Ambiguous" = we don't know whether the server queued the message already.
 *   → Do NOT fall back — that would send a duplicate email (e.g. duplicate OTP).
 *
 * The ONLY genuinely ambiguous SMTP case is when the connection is dropped
 * AFTER the DATA command was acknowledged (i.e. the message body was accepted
 * but the final "250 OK" confirmation never arrived).  Every other timeout /
 * connection error happens BEFORE any data is delivered, so they are definitive.
 */
const DEFINITIVE_SMTP_CODES = new Set([
  'EAUTH',        // Authentication failure
  'ENOTFOUND',    // DNS lookup failure — server unreachable
  'ECONNREFUSED', // TCP connection refused — server not listening / port blocked
  'ECONNRESET',   // Connection reset before message was accepted
  'ESOCKET',      // TLS / generic socket error
]);

/**
 * Lowercase substrings that identify definitive auth/credential failures in
 * the SMTP response message text.
 */
const DEFINITIVE_SMTP_MESSAGES = [
  'invalid login',
  'authentication failed',
  'username and password not accepted',
  '534-5.7.9',
  '535-5.7.8',
  '535 5.7.8',
  '535',           // Catch-all for 535 auth failure codes
  '534',           // Less-secure app block
  'please enable 2-step verification',
  'credentials not accepted',
  'bad credentials',
  'application-specific password required',
];

/**
 * Determine whether an SMTP error is *definitive* (the server did not and
 * will not accept our message) so the caller can safely retry via a different
 * provider without risk of sending a duplicate.
 *
 * Rules:
 *  1. Any code in DEFINITIVE_SMTP_CODES → definitive.
 *  2. ETIMEDOUT:
 *     - Before any SMTP dialogue (!err.command) → definitive (never connected).
 *     - During SMTP dialogue but before DATA (err.command !== 'DATA') → definitive
 *       (server stalled before receiving content).
 *     - After DATA command (err.command === 'DATA') → AMBIGUOUS — the server
 *       may have already accepted the message body; do NOT fall back.
 *  3. Message text matches a known auth-failure string → definitive.
 */
function isDefinitiveSmtpFailure(err) {
  // Explicit code match (EAUTH, ENOTFOUND, ECONNREFUSED, ECONNRESET, ESOCKET)
  if (DEFINITIVE_SMTP_CODES.has(err.code)) return true;

  // ETIMEDOUT — distinguish pre-DATA (definitive) vs post-DATA (ambiguous)
  if (err.code === 'ETIMEDOUT') {
    // No SMTP dialogue started (pure connection timeout) → definitive
    if (!err.command) return true;
    // Mid-dialogue but before DATA — server stalled before accepting any body
    if (err.command !== 'DATA') return true;
    // err.command === 'DATA': message body may already be queued → ambiguous
    return false;
  }

  // Message text match
  const msg = (err.message || '').toLowerCase();
  return DEFINITIVE_SMTP_MESSAGES.some((s) => msg.includes(s));
}

/**
 * Resend HTTP status classification.
 * 4xx = client error (bad auth, bad request, domain not verified) → definitive.
 * 5xx = server error (Resend may have already queued the message) → ambiguous.
 */
function isDefinitiveResendFailure(statusCode) {
  return statusCode >= 400 && statusCode < 500;
}

// ---------------------------------------------------------------------------
// Env-var trim helper
// Strip trailing whitespace AND carriage-returns from values in .env files
// that were saved with Windows line endings (CRLF).  EMAIL_FROM in this
// project is known to end with \r — always pass env vars through this.
// ---------------------------------------------------------------------------
function envTrim(val) {
  return val ? String(val).replace(/[\r\n\s]+$/, '').trim() : val;
}

// ---------------------------------------------------------------------------
// EmailService
// ---------------------------------------------------------------------------

class EmailService {
  constructor() {
    // Trim provider names on startup to avoid whitespace/CR surprises.
    this.primaryProvider   = (envTrim(process.env.EMAIL_PRIMARY_PROVIDER)   || 'gmail').toLowerCase();
    this.secondaryProvider = (envTrim(process.env.EMAIL_SECONDARY_PROVIDER) || 'resend').toLowerCase();

    this.gmailTransporter    = null;
    this._gmailInitAttempted = false;

    // Attempt Gmail initialisation now.  If EMAIL_USER / EMAIL_PASS are not
    // yet defined (e.g. env is loaded lazily), _initGmail() is a no-op and
    // sets _gmailInitAttempted = false so we retry on the first send call.
    this._initGmail();
  }

  // -------------------------------------------------------------------------
  // Gmail / SMTP initialisation
  // -------------------------------------------------------------------------

  /**
   * Initialise (or re-initialise) the Gmail SMTP transporter.
   *
   * Safe to call multiple times:
   *  - If credentials are still missing on a retry, it logs and returns.
   *  - If already successfully initialised, it short-circuits.
   */
  _initGmail() {
    // If we already have a live transporter, nothing to do.
    if (this.gmailTransporter) return;

    const user    = envTrim(process.env.EMAIL_USER);
    const rawPass = process.env.EMAIL_PASS;

    if (!user || !rawPass) {
      // Mark that we tried but credentials were absent — will retry on send.
      this._gmailInitAttempted = false;
      logger.warn('[EMAIL] Gmail SMTP: EMAIL_USER or EMAIL_PASS not set — Gmail provider unavailable (will retry on first send)');
      return;
    }

    // Google App Passwords are displayed in groups of 4 characters with spaces.
    // Strip all whitespace to get the raw 16-character password string.
    const pass   = String(rawPass).replace(/\s+/g, '');
    const port   = parseInt(process.env.EMAIL_PORT, 10) || 587;
    const secure = envTrim(process.env.EMAIL_SECURE) === 'true' || port === 465;
    const host   = envTrim(process.env.EMAIL_HOST) || 'smtp.gmail.com';

    logger.info(`[EMAIL] Initialising Gmail SMTP — host: ${host}, port: ${port}, secure: ${secure}, user: ${user}`);

    this.gmailTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth:              { user, pass },
      connectionTimeout: 15000,  // 15 s to open the TCP connection
      greetingTimeout:   10000,  // 10 s to receive the SMTP greeting banner
      socketTimeout:     20000,  // 20 s idle socket timeout
    });

    this._gmailInitAttempted = true;

    // Verify connection asynchronously — log result but do NOT block startup
    // or the first send call.  Verification failures are logged clearly with
    // actionable hints so the developer can fix them quickly.
    this.gmailTransporter.verify((err) => {
      if (err) {
        const code = err.code || '';
        const msg  = (err.message || '').toLowerCase();
        if (DEFINITIVE_SMTP_CODES.has(code) || DEFINITIVE_SMTP_MESSAGES.some((s) => msg.includes(s))) {
          logger.error(`[EMAIL] Gmail SMTP authentication FAILED (${code}): ${err.message}`);
          logger.error('[EMAIL] Fix checklist:');
          logger.error('[EMAIL]   1. Enable Google 2-Step Verification → myaccount.google.com/security');
          logger.error('[EMAIL]   2. Create an App Password → https://myaccount.google.com/apppasswords');
          logger.error('[EMAIL]   3. Set EMAIL_PASS to the 16-character App Password (spaces are auto-stripped)');
          logger.error('[EMAIL]   4. Confirm EMAIL_USER matches the Google account exactly (no trailing spaces)');
        } else {
          logger.warn(`[EMAIL] Gmail SMTP verify warning (${code}): ${err.message}`);
        }
      } else {
        logger.info(`[EMAIL] Gmail SMTP ready ✓ (${host}:${port})`);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Sender address resolution
  // -------------------------------------------------------------------------

  /**
   * Return the "From" address to use when sending via Gmail SMTP.
   * Falls back to the authenticated user address if EMAIL_FROM is not set.
   * EMAIL_FROM is always trimmed to remove any trailing \r from Windows .env.
   */
  _getGmailFrom() {
    return envTrim(process.env.EMAIL_FROM) || `Sparkle <${envTrim(process.env.EMAIL_USER)}>`;
  }

  /**
   * Return the "From" address to use when sending via Resend.
   *
   * Resend requires the sender domain to be verified in the Resend dashboard.
   * Gmail addresses (@gmail.com) cannot be verified there, so we fall back to
   * Resend's shared onboarding address for testing, or any explicitly
   * configured RESEND_FROM override.
   *
   * Priority:
   *  1. RESEND_FROM env var (explicit override)
   *  2. EMAIL_FROM, IF it does not use @gmail.com
   *  3. 'Sparkle <onboarding@resend.dev>' (Resend shared test sender)
   */
  _getResendFrom() {
    // Explicit override always wins.
    if (process.env.RESEND_FROM) return envTrim(process.env.RESEND_FROM);

    const emailFrom = envTrim(process.env.EMAIL_FROM) || '';

    // Gmail addresses cannot be verified in Resend — use their shared sender.
    if (emailFrom.toLowerCase().includes('@gmail.com')) {
      return 'Sparkle <onboarding@resend.dev>';
    }

    return emailFrom || 'Sparkle <onboarding@resend.dev>';
  }

  // -------------------------------------------------------------------------
  // Plain-text body derivation
  // -------------------------------------------------------------------------

  /**
   * Derive a plain-text email body from the rendered HTML.
   * Strips <style> blocks and all HTML tags, then collapses whitespace.
   * Email clients that prefer or require plain text (some accessibility tools,
   * older mail clients) will use this fallback part of the MIME message.
   */
  _htmlToText(html) {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')  // remove inline CSS
      .replace(/<[^>]+>/g, ' ')                          // strip all tags
      .replace(/\s{2,}/g, ' ')                           // collapse whitespace
      .trim();
  }

  // -------------------------------------------------------------------------
  // Provider send methods
  // -------------------------------------------------------------------------

  /**
   * Send via Gmail SMTP.
   * Lazy-initialises the transporter if credentials became available after
   * construction (e.g. env loaded just-in-time by some middleware).
   */
  async _sendViaGmail({ to, subject, html, text }) {
    // Lazy re-init if the transporter was not ready at construction time.
    if (!this.gmailTransporter && !this._gmailInitAttempted) {
      this._initGmail();
    }

    if (!this.gmailTransporter) {
      throw Object.assign(
        new Error('Gmail SMTP not configured — EMAIL_USER / EMAIL_PASS missing or invalid'),
        { code: 'EAUTH', definitive: true }
      );
    }

    const from = this._getGmailFrom();

    // Attach logo if it exists in public/images — referenced as CID in templates.
    const logoPath    = path.join(__dirname, '../public/images/logo.png');
    const attachments = fs.existsSync(logoPath)
      ? [{ filename: 'logo.png', path: logoPath, cid: 'sparklelogo' }]
      : [];

    logger.info(`[EMAIL] Gmail SMTP — sending to ${to} from "${from}"`);
    const info = await this.gmailTransporter.sendMail({ from, to, subject, html, text, attachments });
    return { messageId: info.messageId, provider: 'gmail' };
  }

  /**
   * Send via Resend HTTP API.
   */
  async _sendViaResend({ to, subject, html, text }) {
    const apiKey = envTrim(process.env.RESEND_API_KEY);
    if (!apiKey) {
      throw Object.assign(
        new Error('Resend API key not configured — RESEND_API_KEY missing'),
        { definitive: true }
      );
    }

    const from = this._getResendFrom();
    logger.info(`[EMAIL] Resend API — sending to ${to} from "${from}"`);

    const response = await axios.post(
      'https://api.resend.com/emails',
      {
        from,
        to:      Array.isArray(to) ? to : [to],
        subject,
        html,
        text,          // plain-text alternative for email clients that prefer it
      },
      {
        headers: {
          Authorization:  `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,  // 15 s — Resend usually responds in < 2 s
      }
    );

    return { messageId: response.data?.id, provider: 'resend' };
  }

  /**
   * Shared send wrapper — adds definitiveness annotation and structured
   * logging to any provider call.  Callers (send / testProviders) decide
   * whether to fall back based on err.definitive.
   */
  async _sendWithProvider(providerName, payload) {
    const tag = `[EMAIL][${providerName.toUpperCase()}]`;
    try {
      logger.info(`${tag} Attempting send to ${payload.to}`);
      let result;
      if      (providerName === 'gmail')  result = await this._sendViaGmail(payload);
      else if (providerName === 'resend') result = await this._sendViaResend(payload);
      else throw new Error(`Unknown provider: ${providerName}`);

      logger.info(`${tag} Accepted — messageId: ${result.messageId}`);
      return result;
    } catch (err) {
      // Annotate the error with definitiveness so callers can decide on fallback.
      let definitive = err.definitive || false;
      if (providerName === 'gmail'  && isDefinitiveSmtpFailure(err))                            definitive = true;
      if (providerName === 'resend' && err.response && isDefinitiveResendFailure(err.response.status)) definitive = true;

      err.definitive   = definitive;
      err.providerName = providerName;

      const kind = definitive ? 'DEFINITIVE FAILURE' : 'AMBIGUOUS FAILURE';
      const code = err.code || (err.response?.status ? `HTTP ${err.response.status}` : 'unknown');
      logger.warn(`${tag} ${kind} (${code}): ${err.message}`);

      // ---- Actionable hints for common Gmail auth failures ----
      if (providerName === 'gmail') {
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('authentication') || msg.includes('535') || msg.includes('534') || err.code === 'EAUTH') {
          logger.error('[EMAIL] Gmail auth fix checklist:');
          logger.error('[EMAIL]   1. Enable 2-Step Verification at myaccount.google.com/security');
          logger.error('[EMAIL]   2. Create an App Password: https://myaccount.google.com/apppasswords');
          logger.error('[EMAIL]   3. Set EMAIL_PASS to the 16-character App Password (spaces ok — stripped automatically)');
          logger.error('[EMAIL]   4. Ensure EMAIL_USER matches the Google account exactly');
        }
        if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
          logger.error('[EMAIL] Gmail SMTP unreachable — check outbound port 587 is not blocked in your hosting environment (Render blocks some SMTP ports).');
        }
      }

      // ---- Actionable hints for Resend domain errors ----
      if (providerName === 'resend' && err.response?.data) {
        const resendError = err.response.data;
        logger.warn(`[EMAIL][RESEND] API error detail: ${JSON.stringify(resendError)}`);
        if (resendError?.name === 'validation_error' || resendError?.message?.includes('domain')) {
          logger.error('[EMAIL][RESEND] Domain not verified. Add and verify your sending domain at https://resend.com/domains');
          logger.error('[EMAIL][RESEND] For testing without a custom domain, set RESEND_FROM=Sparkle <onboarding@resend.dev>');
        }
      }

      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Public send API — primary → fallback with same OTP/payload
  // -------------------------------------------------------------------------

  /**
   * Send a templated email using the configured primary provider, falling back
   * to the secondary ONLY on a *definitive* failure (i.e. the primary
   * confirmed it did not and will not deliver the message).
   *
   * On an *ambiguous* failure (timeout AFTER message was potentially accepted)
   * we do NOT fall back — that would send a duplicate email / OTP.
   *
   * The HTML is rendered once; the same body is passed to both providers so
   * the OTP or token in the body is never regenerated.
   *
   * @param {object} opts
   * @param {string}  opts.to            Recipient email address
   * @param {string}  opts.subject       Email subject line
   * @param {string}  opts.templateName  Template key (see email-templates.js)
   * @param {object} [opts.templateData] Data interpolated into the template
   * @returns {Promise<object>}
   *   Success:   { messageId, provider, fallbackUsed: boolean }
   *   Ambiguous: { uncertain: true, provider, error }
   *   All failed:{ error, allProvidersFailed: true }
   *   Template:  { error, templateFailed: true }
   */
  async send({ to, subject, templateName, templateData = {} }) {
    // --- Render template once ---
    let html;
    try {
      html = renderTemplate(templateName, templateData || {});
    } catch (tplErr) {
      logger.error(`[EMAIL] Template render failed for "${templateName}": ${tplErr.message}`);
      return { error: tplErr.message, templateFailed: true };
    }

    // --- Build plain-text alternative (for accessibility & older clients) ---
    const text = this._htmlToText(html);

    const payload   = { to, subject, html, text };
    const primary   = this.primaryProvider;
    const secondary = this.secondaryProvider;

    logger.info(`[EMAIL] Sending "${subject}" to ${to} — primary: ${primary.toUpperCase()}, secondary: ${secondary.toUpperCase()}`);

    // ---- Try primary provider ----
    try {
      const result = await this._sendWithProvider(primary, payload);
      logger.info(`[EMAIL] ✓ Email delivered via ${primary} to ${to}`);
      return { ...result, fallbackUsed: false };
    } catch (primaryErr) {
      if (!primaryErr.definitive) {
        // The primary may have already queued the message.
        // Do NOT send via the secondary — that risks a duplicate OTP.
        logger.warn(`[EMAIL] ⚠ Primary "${primary}" ambiguous failure — NOT falling back to avoid duplicate. Error: ${primaryErr.message}`);
        return { uncertain: true, provider: primary, error: primaryErr.message };
      }
      logger.warn(`[EMAIL] ✗ Primary "${primary}" definitive failure — trying secondary "${secondary}"`);
    }

    // ---- Try secondary provider (same payload — same OTP in body) ----
    try {
      const result = await this._sendWithProvider(secondary, payload);
      logger.info(`[EMAIL] ✓ Email delivered via ${secondary} (fallback) to ${to}`);
      return { ...result, fallbackUsed: true };
    } catch (secondaryErr) {
      logger.error(`[EMAIL] ✗ ALL providers failed for ${to}`);
      logger.error(`[EMAIL]   Secondary "${secondary}" error: ${secondaryErr.message}`);
      return { error: secondaryErr.message, allProvidersFailed: true };
    }
  }

  // -------------------------------------------------------------------------
  // Diagnostic / test methods (admin use only)
  // -------------------------------------------------------------------------

  /**
   * Returns current provider configuration status without sending anything.
   * Safe to call at any time — no network activity.
   *
   * @returns {object} Configuration snapshot for both providers.
   */
  getProviderStatus() {
    const gmailUser    = envTrim(process.env.EMAIL_USER);
    const gmailPass    = process.env.EMAIL_PASS;
    const resendKey    = envTrim(process.env.RESEND_API_KEY);
    // App Passwords are 16 characters when spaces are stripped.
    const hasGmailPass = !!(gmailPass && String(gmailPass).replace(/\s+/g, '').length >= 16);

    return {
      primary:   this.primaryProvider,
      secondary: this.secondaryProvider,
      gmail: {
        configured:       !!(gmailUser && hasGmailPass),
        user:             gmailUser ? `${gmailUser.slice(0, 3)}***@${gmailUser.split('@')[1] || '?'}` : null,
        host:             envTrim(process.env.EMAIL_HOST) || 'smtp.gmail.com',
        port:             parseInt(process.env.EMAIL_PORT, 10) || 587,
        secure:           envTrim(process.env.EMAIL_SECURE) === 'true' || (parseInt(process.env.EMAIL_PORT, 10) || 587) === 465,
        transporterReady: !!this.gmailTransporter,
        senderFrom:       this._getGmailFrom(),
      },
      resend: {
        configured:  !!(resendKey && resendKey.startsWith('re_')),
        keyPrefix:   resendKey ? resendKey.slice(0, 6) + '***' : null,
        senderFrom:  this._getResendFrom(),
      },
    };
  }

  /**
   * Test both providers independently by sending clearly-labelled diagnostic
   * emails to testEmail.  Does NOT issue a real user OTP.
   *
   * @param {string} testEmail  Recipient for the diagnostic emails.
   * @returns {Promise<object>} { gmail, resend, providerStatus }
   */
  async testProviders(testEmail) {
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:20px;border:2px dashed #e53e3e;border-radius:8px;">
        <h2 style="color:#e53e3e;margin-top:0;">⚙ Sparkle Email Diagnostic</h2>
        <p>This is a <strong>diagnostic test email</strong> from the Sparkle backend email service.</p>
        <p>If you received this, the sending provider is working correctly.</p>
        <p style="font-size:12px;color:#666;">Sent at: ${new Date().toISOString()}</p>
      </div>`;
    const text = 'Sparkle Email Diagnostic Test — if you received this, the provider is working correctly.';

    const results = { gmail: null, resend: null, providerStatus: this.getProviderStatus() };

    // ---- Test Gmail ----
    try {
      logger.info('[EMAIL][TEST] Testing Gmail SMTP...');
      const r = await this._sendViaGmail({ to: testEmail, subject: '[Sparkle] Gmail SMTP Diagnostic Test', html, text });
      results.gmail = { success: true, messageId: r.messageId };
      logger.info('[EMAIL][TEST] Gmail SMTP test: SUCCESS');
    } catch (err) {
      results.gmail = { success: false, error: err.message, code: err.code, definitive: err.definitive };
      logger.warn(`[EMAIL][TEST] Gmail SMTP test: FAILED — ${err.message}`);
    }

    // ---- Test Resend ----
    try {
      logger.info('[EMAIL][TEST] Testing Resend API...');
      const r = await this._sendViaResend({ to: testEmail, subject: '[Sparkle] Resend API Diagnostic Test', html, text });
      results.resend = { success: true, messageId: r.messageId };
      logger.info('[EMAIL][TEST] Resend API test: SUCCESS');
    } catch (err) {
      results.resend = {
        success:    false,
        error:      err.message,
        httpStatus: err.response?.status,
        apiError:   err.response?.data,
        definitive: err.definitive,
      };
      logger.warn(`[EMAIL][TEST] Resend API test: FAILED — ${err.message}`);
    }

    return results;
  }

  /**
   * Test the combined primary → fallback flow with a diagnostic email.
   * Useful for end-to-end failover verification.
   *
   * @param {string} testEmail  Recipient for the failover diagnostic email.
   */
  async testFailover(testEmail) {
    return this.send({
      to:           testEmail,
      subject:      '[Sparkle] Failover Diagnostic Test',
      templateName: 'diagnostic-test',
      templateData: { testEmail, timestamp: new Date().toISOString() },
    });
  }
}

// ---------------------------------------------------------------------------
// Singleton — instantiated once at require() time.
//
// Gmail verify() runs asynchronously in the background and does not block
// startup.  If EMAIL_USER / EMAIL_PASS are absent at module-load time
// (e.g. env loaded later), the transporter is initialised lazily on the
// first call to _sendViaGmail().
// ---------------------------------------------------------------------------
module.exports = new EmailService();
