// services/referral.service.js
// Production-grade Referral Attribution & Reward Service for Sparkle
'use strict';

const crypto = require('crypto');
const pool = require('../config/database');
const { safeQuery } = require('../config/database');
const logger = require('../utils/logger');

// Reward amount in KES (configurable via environment)
const DEFAULT_REWARD_AMOUNT = parseFloat(process.env.REFERRAL_REWARD_AMOUNT || '60.00');
const REWARD_CURRENCY = process.env.REFERRAL_CURRENCY || 'KES';
// Trigger for qualification: 'signup_completed' | 'onboarding_completed' | 'email_verified'
const REWARD_TRIGGER = process.env.REFERRAL_REWARD_TRIGGER || 'signup_completed';

/**
 * Returns the canonical public URL for Sparkle referral links
 */
function getCanonicalBaseUrl(req) {
  if (process.env.PUBLIC_APP_URL) {
    return process.env.PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (process.env.APP_URL && !process.env.APP_URL.includes('localhost')) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  if (req) {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const proto = forwardedProto ? forwardedProto.split(',')[0].trim() : (req.protocol || 'https');
    const host = req.headers['x-forwarded-host'] || req.get('host');
    if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      return `${proto}://${host}`;
    }
  }
  return 'https://sparklewebapp.vercel.app';
}

/**
 * Deterministically generates a friendly alphanumeric referral code for a user
 * e.g., username "donbabu" -> "DONB7F3"
 */
function generateDeterministicCode(user) {
  const rawUsername = (user.username || 'SPARKLE').trim();
  const cleanPrefix = rawUsername.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'SPRK';
  const seed = (user.user_id || user.id || rawUsername).toString();
  const hashPart = crypto.createHash('md5').update(seed).digest('hex').slice(0, 3).toUpperCase();
  return `${cleanPrefix}${hashPart}`;
}

class ReferralService {
  /**
   * Retrieves or creates a canonical referral code for the user
   */
  static async getOrCreateUserReferralCode(user) {
    const userId = user.user_id || user.id || user.userId;
    if (!userId) throw new Error('Valid user_id required to get or create referral code');

    // 1. Check existing code in DB
    const existing = await safeQuery(
      'SELECT id, user_id, code, active FROM referral_codes WHERE user_id = ? LIMIT 1',
      [userId]
    );

    if (existing && existing.length > 0) {
      return existing[0];
    }

    // 2. Generate initial candidate code
    let candidateCode = generateDeterministicCode(user);
    let attempts = 0;

    while (attempts < 5) {
      try {
        const id = crypto.randomUUID();
        await pool.query(
          'INSERT INTO referral_codes (id, user_id, code, active) VALUES (?, ?, ?, 1)',
          [id, userId, candidateCode]
        );
        return { id, user_id: userId, code: candidateCode, active: 1 };
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          // If code collision, append a random 2-char suffix
          const randomSuffix = crypto.randomBytes(2).toString('hex').slice(0, 2).toUpperCase();
          candidateCode = `${candidateCode.slice(0, 5)}${randomSuffix}`;
          attempts++;
        } else {
          logger.error('[ReferralService] Error saving referral code:', err);
          throw err;
        }
      }
    }

    throw new Error('Could not generate unique referral code after 5 attempts');
  }

  /**
   * Get public invite details by referral code
   */
  static async getPublicInviteInfo(code) {
    if (!code || typeof code !== 'string') return { valid: false, message: 'Invalid referral code.Please check if the digits are correct or ask the referee to resend them.' };
    const cleanCode = code.trim().toUpperCase();

    const rows = await safeQuery(
      `SELECT rc.id AS code_id, rc.code, rc.active, rc.user_id AS referrer_id,
              u.username, u.name, u.avatar_url, u.account_status, u.deleted_at
       FROM referral_codes rc
       JOIN users u ON u.user_id = rc.user_id
       WHERE rc.code = ? LIMIT 1`,
      [cleanCode]
    );

    if (!rows || rows.length === 0) {
      return { valid: false, message: 'This invitation is expired or no longer available.' };
    }

    const row = rows[0];
    if (!row.active || row.deleted_at || (row.account_status && ['suspended', 'deleted', 'banned'].includes(row.account_status.toLowerCase()))) {
      return { valid: false, message: 'This invitation is no longer available.' };
    }

    return {
      valid: true,
      code: row.code,
      codeId: row.code_id,
      referrer: {
        id: row.referrer_id,
        username: row.username,
        name: row.name || row.username,
        avatar_url: row.avatar_url || null
      }
    };
  }

  /**
   * Records a referral link click and issues a secure, short-lived handoff token
   */
  static async recordClick({ code, anonymousSessionId, platform = 'web', source = 'invite_link', userAgent, ip, req }) {
    const inviteInfo = await this.getPublicInviteInfo(code);
    if (!inviteInfo.valid) {
      return { success: false, message: inviteInfo.message };
    }

    const clickId = crypto.randomUUID();
    // Cryptographically secure, unguessable opaque handoff token
    const handoffToken = crypto.randomBytes(32).toString('hex');
    const handoffTokenHash = crypto.createHash('sha256').update(handoffToken).digest('hex');

    // Hash IP address with salt for abuse prevention without storing raw PII
    const ipSalt = process.env.JWT_SECRET || 'sparkle_referral_salt';
    const ipHash = ip ? crypto.createHash('sha256').update(`${ip}:${ipSalt}`).digest('hex') : null;

    // Token expires in 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO referral_clicks 
       (id, referral_code_id, referrer_user_id, code, anonymous_session_id, handoff_token_hash, platform, source, user_agent, ip_hash, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'clicked', ?)`,
      [
        clickId,
        inviteInfo.codeId,
        inviteInfo.referrer.id,
        inviteInfo.code,
        anonymousSessionId || null,
        handoffTokenHash,
        platform.slice(0, 32),
        source.slice(0, 64),
        (userAgent || '').slice(0, 255),
        ipHash,
        expiresAt
      ]
    );

    logger.info(`[ReferralService] REFERRAL_CLICK recorded: clickId=${clickId}, code=${inviteInfo.code}, referrer=${inviteInfo.referrer.username}`);

    const canonicalUrl = `${getCanonicalBaseUrl(req)}/invite/${inviteInfo.code}`;

    return {
      success: true,
      clickId,
      handoffToken, // Client can persist in local storage or app launch params
      referralCode: inviteInfo.code,
      canonicalUrl,
      referrer: inviteInfo.referrer,
      expiresAt: expiresAt.toISOString()
    };
  }

  /**
   * Resolves a handoff token or referral code back to the referrer
   */
  static async resolveHandoff(handoffToken, fallbackCode) {
    if (handoffToken) {
      const tokenHash = crypto.createHash('sha256').update(handoffToken).digest('hex');
      const rows = await safeQuery(
        `SELECT rc.id AS click_id, rc.referral_code_id, rc.referrer_user_id, rc.code, rc.status, rc.expires_at,
                u.username, u.name, u.avatar_url
         FROM referral_clicks rc
         JOIN users u ON u.user_id = rc.referrer_user_id
         WHERE rc.handoff_token_hash = ? AND (rc.expires_at IS NULL OR rc.expires_at > NOW())
         ORDER BY rc.created_at DESC LIMIT 1`,
        [tokenHash]
      );

      if (rows && rows.length > 0) {
        const row = rows[0];
        return {
          valid: true,
          clickId: row.click_id,
          code: row.code,
          codeId: row.referral_code_id,
          referrer: {
            id: row.referrer_user_id,
            username: row.username,
            name: row.name,
            avatar_url: row.avatar_url
          }
        };
      }
    }

    if (fallbackCode) {
      return await this.getPublicInviteInfo(fallbackCode);
    }

    return { valid: false, message: 'Referral could not be resolved' };
  }

  /**
   * Atomically attributes a new user registration to their referrer
   * Strictly enforces:
   * 1. Self-referral prevention (referrer === referred)
   * 2. Single permanent attribution per user (referred_user_id is UNIQUE)
   * 3. Referrer account must be active & valid
   * 4. Idempotent & transactional
   */
  static async attributeSignup({ newUserId, referralCode, handoffToken, attributionMethod = 'invite_link', conn = null }) {
    if (!newUserId) return { attributed: false, reason: 'missing_user_id' };

    // Check if user is already attributed (immutable)
    const existingAttr = await safeQuery(
      'SELECT id, referrer_user_id, status FROM referrals WHERE referred_user_id = ? LIMIT 1',
      [newUserId]
    );

    if (existingAttr && existingAttr.length > 0) {
      return { attributed: false, reason: 'already_referred', existing: existingAttr[0] };
    }

    // Resolve referrer from handoffToken or referralCode
    let resolved = null;
    if (handoffToken) {
      resolved = await this.resolveHandoff(handoffToken);
    }
    if ((!resolved || !resolved.valid) && referralCode) {
      resolved = await this.getPublicInviteInfo(referralCode);
    }

    if (!resolved || !resolved.valid) {
      return { attributed: false, reason: 'unresolved_referral' };
    }

    const referrerUserId = resolved.referrer?.id || resolved.referrer_id;
    if (!referrerUserId) {
      return { attributed: false, reason: 'missing_referrer' };
    }

    // RULE 1: Self-referral prevention
    if (String(referrerUserId) === String(newUserId)) {
      logger.warn(`[ReferralService] REFERRAL_REJECTED: User ${newUserId} attempted self-referral`);
      return { attributed: false, reason: 'self_referral' };
    }

    // RULE 2: Referrer account status check
    const referrerCheck = await safeQuery(
      'SELECT user_id, username, account_status, deleted_at FROM users WHERE user_id = ? LIMIT 1',
      [referrerUserId]
    );
    if (!referrerCheck || referrerCheck.length === 0 || referrerCheck[0].deleted_at) {
      return { attributed: false, reason: 'invalid_referrer' };
    }

    const referralId = crypto.randomUUID();
    const clickId = resolved.clickId || null;
    const codeId = resolved.codeId || null;

    const executeSql = async (dbConn) => {
      // 1. Insert referral record
      await dbConn.execute(
        `INSERT INTO referrals 
         (id, referrer_user_id, referred_user_id, referral_code_id, click_id, status, attribution_method, attributed_at)
         VALUES (?, ?, ?, ?, ?, 'joined', ?, NOW())`,
        [referralId, referrerUserId, newUserId, codeId, clickId, attributionMethod]
      );

      // 2. Mark click as joined if clickId exists
      if (clickId) {
        await dbConn.execute(
          "UPDATE referral_clicks SET status = 'joined' WHERE id = ?",
          [clickId]
        );
      }

      logger.info(`[ReferralService] REFERRAL_ATTRIBUTED: referrer=${referrerUserId}, referred=${newUserId}, method=${attributionMethod}`);

      // 3. Auto-qualify if REWARD_TRIGGER is 'signup_completed'
      if (REWARD_TRIGGER === 'signup_completed') {
        await ReferralService._processQualification(dbConn, referralId, referrerUserId, newUserId);
      }
    };

    if (conn) {
      await executeSql(conn);
    } else {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await executeSql(connection);
        await connection.commit();
      } catch (err) {
        await connection.rollback();
        if (err.code === 'ER_DUP_ENTRY') {
          return { attributed: false, reason: 'already_referred' };
        }
        logger.error('[ReferralService] Attribution transaction error:', err);
        throw err;
      } finally {
        connection.release();
      }
    }

    return {
      attributed: true,
      referralId,
      referrerUserId,
      code: resolved.code
    };
  }

  /**
   * Internal helper to qualify a referral and issue rewards atomically
   */
  static async _processQualification(conn, referralId, referrerUserId, referredUserId) {
    try {
      const rewardId = crypto.randomUUID();

      // 1. Insert reward record (UNIQUE constraint on referral_id prevents duplicate reward)
      await conn.execute(
        `INSERT INTO referral_rewards 
         (id, referral_id, referrer_user_id, reward_type, reward_amount, currency, status, created_at)
         VALUES (?, ?, ?, 'wallet_credit', ?, ?, 'credited', NOW())
         ON DUPLICATE KEY UPDATE status = status`,
        [rewardId, referralId, referrerUserId, DEFAULT_REWARD_AMOUNT, REWARD_CURRENCY]
      );

      // 2. Update referral status to qualified and rewarded
      await conn.execute(
        `UPDATE referrals 
         SET status = 'rewarded', qualified_at = NOW(), rewarded_at = NOW()
         WHERE id = ?`,
        [referralId]
      );

      // 3. Dispatch in-app notification to the referrer
      const notifId = crypto.randomUUID();
      const referredUserRow = await safeQuery(
        'SELECT username, name FROM users WHERE user_id = ? LIMIT 1',
        [referredUserId]
      );
      const friendName = referredUserRow?.[0]?.username ? `@${referredUserRow[0].username}` : 'A friend';

      await conn.execute(
        `INSERT INTO notifications (notification_id, user_id, type, title, content, action_url, is_read)
         VALUES (?, ?, 'referral_reward', 'Referral Reward Received! 🎉', ?, '/invite', 0)`,
        [
          notifId,
          referrerUserId,
          `${friendName} joined Sparkle with your invite! You earned ${REWARD_CURRENCY} ${DEFAULT_REWARD_AMOUNT.toFixed(0)}.`
        ]
      ).catch(e => logger.warn('[ReferralService] Could not insert notification:', e.message));

      logger.info(`[ReferralService] REFERRAL_REWARDED: referralId=${referralId}, referrer=${referrerUserId}, amount=${DEFAULT_REWARD_AMOUNT} ${REWARD_CURRENCY}`);
    } catch (err) {
      logger.error('[ReferralService] Error qualifying referral:', err);
      throw err;
    }
  }

  /**
   * Qualifies a pending referral (called upon onboarding completion or email verification)
   */
  static async qualifyReferral(referredUserId) {
    if (!referredUserId) return { qualified: false };

    const rows = await safeQuery(
      "SELECT id, referrer_user_id, status FROM referrals WHERE referred_user_id = ? AND status IN ('joined', 'pending') LIMIT 1",
      [referredUserId]
    );

    if (!rows || rows.length === 0) {
      return { qualified: false, reason: 'no_eligible_referral' };
    }

    const { id: referralId, referrer_user_id: referrerUserId } = rows[0];

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await this._processQualification(connection, referralId, referrerUserId, referredUserId);
      await connection.commit();
      return { qualified: true, referralId, referrerUserId };
    } catch (err) {
      await connection.rollback();
      logger.error('[ReferralService] qualifyReferral error:', err);
      return { qualified: false, error: err.message };
    } finally {
      connection.release();
    }
  }

  /**
   * Returns comprehensive, 100% real referral metrics and stats for the authenticated user
   */
  static async getReferralStats(user, req = null) {
    const userId = user.user_id || user.id || user.userId;
    if (!userId) throw new Error('User ID required for referral stats');

    // Ensure referral code exists for user
    const userCodeRecord = await this.getOrCreateUserReferralCode(user);
    const code = userCodeRecord.code;
    const canonicalUrl = `${getCanonicalBaseUrl(req)}/invite/${code}`;

    // 1. Real referral counts from referrals table
    const [counts] = await safeQuery(
      `SELECT 
         COUNT(*) AS total_joined,
         COUNT(CASE WHEN status IN ('qualified', 'rewarded') THEN 1 END) AS qualified_count,
         COUNT(CASE WHEN status IN ('pending', 'joined', 'signup_started') THEN 1 END) AS pending_count,
         COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) AS weekly_joined
       FROM referrals
       WHERE referrer_user_id = ?`,
      [userId]
    );

    // 2. Real click counts from referral_clicks table
    const [clickStats] = await safeQuery(
      `SELECT 
         COUNT(*) AS total_clicks,
         COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) AS weekly_clicks
       FROM referral_clicks
       WHERE referrer_user_id = ?`,
      [userId]
    );

    // 3. Real rewards from referral_rewards table
    const [rewardStats] = await safeQuery(
      `SELECT 
         COALESCE(SUM(reward_amount), 0) AS total_earnings,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN reward_amount ELSE 0 END), 0) AS pending_earnings,
         COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN reward_amount ELSE 0 END), 0) AS weekly_earnings
       FROM referral_rewards
       WHERE referrer_user_id = ?`,
      [userId]
    );

    const totalInvitedClicks = parseInt(clickStats?.total_clicks || 0, 10);
    const totalJoined = parseInt(counts?.total_joined || 0, 10);
    const totalQualified = parseInt(counts?.qualified_count || 0, 10);
    const pendingReferrals = parseInt(counts?.pending_count || 0, 10);
    const totalEarnings = parseFloat(rewardStats?.total_earnings || 0);
    const pendingRewards = parseFloat(rewardStats?.pending_earnings || 0);
    const weeklyInvites = parseInt(clickStats?.weekly_clicks || 0, 10);
    const weeklyActive = parseInt(counts?.weekly_joined || 0, 10);
    const weeklyEarnings = parseFloat(rewardStats?.weekly_earnings || 0);

    return {
      referralCode: code,
      inviteCode: code,
      referralLink: canonicalUrl,
      url: canonicalUrl,
      stats: {
        invited: totalInvitedClicks,
        joined: totalJoined,
        qualified: totalQualified,
        pending: pendingReferrals,
        rewards: totalEarnings,
        pendingRewards: pendingRewards,
        currency: REWARD_CURRENCY
      },
      // Flat properties for backward compatibility with existing components
      friendsInvited: totalInvitedClicks > 0 ? totalInvitedClicks : totalJoined,
      successfulSignups: totalJoined,
      pendingReferrals,
      totalEarnings,
      pendingRewards,
      weeklyInvites,
      weeklyActive,
      weeklyEarnings
    };
  }

  /**
   * Returns real referral history for the authenticated user
   */
  static async getReferralHistory(userId, limit = 50) {
    if (!userId) return [];

    const rows = await safeQuery(
      `SELECT r.id, r.referred_user_id, r.status, r.attribution_method, r.created_at, r.qualified_at, r.rewarded_at,
              u.username, u.name, u.avatar_url,
              COALESCE(rw.reward_amount, 0) AS reward_amount,
              COALESCE(rw.currency, 'KES') AS currency,
              rw.status AS reward_status
       FROM referrals r
       JOIN users u ON u.user_id = r.referred_user_id
       LEFT JOIN referral_rewards rw ON rw.referral_id = r.id
       WHERE r.referrer_user_id = ?
       ORDER BY r.created_at DESC
       LIMIT ?`,
      [userId, limit]
    );

    if (!rows || rows.length === 0) return [];

    return rows.map(r => {
      let statusLabel = 'Joined';
      if (r.status === 'rewarded') statusLabel = 'Rewarded';
      else if (r.status === 'qualified') statusLabel = 'Active';
      else if (r.status === 'pending') statusLabel = 'Pending';

      const amount = parseFloat(r.reward_amount);
      const rewardFormatted = amount > 0 ? `+${r.currency} ${amount.toFixed(0)}` : `${r.currency} 0`;

      const d = new Date(r.created_at);
      const joinedDate = `Joined ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

      return {
        id: r.id,
        userId: r.referred_user_id,
        username: r.username,
        name: r.name || r.username,
        avatar: r.avatar_url || null,
        joinedDate,
        createdAt: r.created_at,
        status: statusLabel,
        rawStatus: r.status,
        reward: rewardFormatted,
        rewardAmount: amount
      };
    });
  }

  /**
   * Returns real leaderboard from real database referral data
   */
  static async getLeaderboard(currentUserId) {
    // 1. Top referrers calculated strictly from real database records
    const topRows = await safeQuery(
      `SELECT u.user_id, u.username, u.name, u.avatar_url,
              COUNT(r.id) AS total_invites,
              COALESCE(SUM(rw.reward_amount), 0) AS total_earnings
       FROM referrals r
       JOIN users u ON u.user_id = r.referrer_user_id
       LEFT JOIN referral_rewards rw ON rw.referral_id = r.id
       WHERE r.status IN ('joined', 'qualified', 'rewarded')
       GROUP BY r.referrer_user_id
       ORDER BY total_invites DESC, total_earnings DESC
       LIMIT 10`
    );

    const topReferrers = (topRows || []).map((row, index) => ({
      rank: index + 1,
      userId: row.user_id,
      username: row.username,
      name: row.name || row.username,
      avatar: row.avatar_url || null,
      invites: parseInt(row.total_invites, 10),
      earnings: parseFloat(row.total_earnings)
    }));

    // 2. Calculate current user's actual rank
    let currentUserRank = null;
    if (currentUserId) {
      const [userStats] = await safeQuery(
        `SELECT COUNT(r.id) AS total_invites,
                COALESCE(SUM(rw.reward_amount), 0) AS total_earnings
         FROM referrals r
         LEFT JOIN referral_rewards rw ON rw.referral_id = r.id
         WHERE r.referrer_user_id = ? AND r.status IN ('joined', 'qualified', 'rewarded')`,
        [currentUserId]
      );

      const userInvites = parseInt(userStats?.total_invites || 0, 10);
      const userEarnings = parseFloat(userStats?.total_earnings || 0);

      if (userInvites > 0) {
        // Count how many users have strictly more invites
        const [higherCount] = await safeQuery(
          `SELECT COUNT(*) AS ahead_count FROM (
             SELECT r.referrer_user_id, COUNT(r.id) AS cnt
             FROM referrals r
             WHERE r.status IN ('joined', 'qualified', 'rewarded')
             GROUP BY r.referrer_user_id
             HAVING cnt > ?
           ) t`,
          [userInvites]
        );
        currentUserRank = {
          rank: (higherCount?.ahead_count || 0) + 1,
          invites: userInvites,
          earnings: userEarnings
        };
      } else {
        currentUserRank = {
          rank: 0,
          invites: 0,
          earnings: 0
        };
      }
    }

    return {
      topReferrers,
      currentUser: currentUserRank
    };
  }

  /**
   * Returns active, transparent reward rules
   */
  static getRewardRules() {
    return [
      {
        id: 'active_referral',
        title: 'Per Active Friend',
        reward: `${REWARD_CURRENCY} ${DEFAULT_REWARD_AMOUNT.toFixed(0)}`,
        description: `Earn ${REWARD_CURRENCY} ${DEFAULT_REWARD_AMOUNT.toFixed(0)} when your friend joins Sparkle.`,
        icon: 'user'
      },
      {
        id: 'bonus_milestone',
        title: 'Top Referrer Community Bonus',
        reward: `Up to ${REWARD_CURRENCY} 1,000`,
        description: 'Special monthly community grants for top active ambassadors.',
        icon: 'star'
      }
    ];
  }
}

module.exports = ReferralService;
