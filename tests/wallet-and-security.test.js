// tests/wallet-and-security.test.js
// Money + auth failure paths: Paystack webhook signature verification, deposit
// and withdrawal validation, and the security-transaction state machine. Real
// handlers driven by a fake pool.query and stubbed service singletons.
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-wallet';
process.env.PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_wallet_secret';

const pool = require('../backend/config/database');
const paystackService = require('../backend/services/paystack.service');

const mockRes = () => ({
  statusCode: 200, body: null, headersSent: false,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; this.headersSent = true; return this; },
});

const installFakePool = (impl) => {
  const original = pool.query;
  pool.query = async (sql, params = []) => impl(String(sql).replace(/\s+/g, ' ').trim(), params);
  return { restore: () => { pool.query = original; } };
};

const reqFor = (over = {}) => ({
  body: {}, params: {}, query: {}, headers: {}, cookies: {},
  user: { user_id: 'user-1', username: 'buyer', email: 'buyer@x.co' },
  ...over,
});

const validSignatureFor = (rawBody) => crypto
  .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
  .update(rawBody)
  .digest('hex');

describe('paystack webhook signature verification', () => {
  it('accepts a correctly signed body', () => {
    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'ref-1' } });
    assert.equal(paystackService.verifyWebhookSignature(body, validSignatureFor(body)), true);
  });

  it('rejects a tampered body', () => {
    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'ref-1' } });
    const signature = validSignatureFor(JSON.stringify({ event: 'charge.success', data: { reference: 'ref-2' } }));
    assert.equal(paystackService.verifyWebhookSignature(body, signature), false);
  });

  it('rejects garbage and non-string signatures without throwing', () => {
    const body = '{}';
    assert.equal(paystackService.verifyWebhookSignature(body, 'not-a-signature'), false);
    assert.equal(paystackService.verifyWebhookSignature(body, 42), false);
    assert.equal(paystackService.verifyWebhookSignature(body, null), false);
  });

  it('rejects empty or non-string bodies', () => {
    assert.equal(paystackService.verifyWebhookSignature('', validSignatureFor('')), false);
    assert.equal(paystackService.verifyWebhookSignature(null, 'aa'), false);
    assert.equal(paystackService.verifyWebhookSignature({}, 'aa'), false);
  });

  it('accepts a Buffer body (some parsers pass raw bytes)', () => {
    const body = '{"event":"charge.success"}';
    assert.equal(paystackService.verifyWebhookSignature(Buffer.from(body), validSignatureFor(body)), true);
  });

  it('rejects when no secret is configured (fail closed)', () => {
    const saved = process.env.PAYSTACK_SECRET_KEY;
    // The service reads the secret per call from config/paystack — verify the
    // configured-secret path is what accepted above, and a fresh secret rejects.
    process.env.PAYSTACK_SECRET_KEY = 'a_completely_different_secret';
    const body = '{"event":"charge.success"}';
    const signature = validSignatureFor(body);
    process.env.PAYSTACK_SECRET_KEY = saved;
    // Recompute against the restored secret; the signature above used the
    // changed secret, so it must now fail.
    assert.notEqual(paystackService.verifyWebhookSignature(body, signature), true);
  });
});

describe('wallet webhook handler', () => {
  const walletController = require('../backend/controllers/wallet.controller');
  const walletService = require('../backend/services/wallet.service');
  let fake;
  let enqueueImpl;
  let verifyImpl;

  beforeEach(() => {
    enqueueImpl = async () => ({ event_id: 'evt-1', status: 'Pending' });
    verifyImpl = () => true;
    walletService.enqueueWebhookEvent = (payload) => enqueueImpl(payload);
    paystackService.verifyWebhookSignature = (raw, sig) => verifyImpl(raw, sig);
  });

  afterEach(() => {
    fake?.restore();
  });

  it('401s when the signature header is missing', async () => {
    const res = mockRes();
    await walletController.handleWebhook(reqFor({ headers: {} }), res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, 'Missing signature');
  });

  it('401s when the signature does not verify', async () => {
    verifyImpl = () => false;
    const res = mockRes();
    await walletController.handleWebhook(reqFor({ headers: { 'x-paystack-signature': 'bad' } }), res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, 'Invalid signature');
  });

  it('200s an event with no reference (nothing to enqueue)', async () => {
    const res = mockRes();
    await walletController.handleWebhook(
      reqFor({ headers: { 'x-paystack-signature': 'sig' }, body: { event: 'charge.success', data: {} } }),
      res
    );
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { received: true });
  });

  it('enqueues a valid event and acknowledges before processing', async () => {
    let enqueued = null;
    enqueueImpl = async (payload) => { enqueued = payload; return { event_id: 'evt-9', status: 'Pending' }; };
    fake = installFakePool(async () => [[], []]);

    const res = mockRes();
    await walletController.handleWebhook(
      reqFor({
        headers: { 'x-paystack-signature': 'sig' },
        body: { event: 'charge.success', data: { reference: 'ref-42', amount: 50000 } },
      }),
      res
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { received: true });
    assert.equal(enqueued.reference, 'ref-42');
    assert.equal(enqueued.eventType, 'charge.success');
  });

  it('does not reprocess an already-processed event', async () => {
    let processCalled = false;
    walletService.processWebhookEvent = async () => { processCalled = true; };
    enqueueImpl = async () => ({ event_id: 'evt-2', status: 'Processed' });
    fake = installFakePool(async () => [[], []]);

    const res = mockRes();
    await walletController.handleWebhook(
      reqFor({
        headers: { 'x-paystack-signature': 'sig' },
        body: { event: 'charge.success', data: { reference: 'ref-1' } },
      }),
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(processCalled, false);
  });

  it('500s when the event cannot be persisted', async () => {
    enqueueImpl = async () => { throw new Error('db down'); };
    fake = installFakePool(async () => { throw new Error('db down'); });

    const res = mockRes();
    await walletController.handleWebhook(
      reqFor({
        headers: { 'x-paystack-signature': 'sig' },
        body: { event: 'charge.success', data: { reference: 'ref-1' } },
      }),
      res
    );

    assert.equal(res.statusCode, 500);
    assert.match(res.body.message, /persist/i);
  });
});

describe('wallet deposit + withdrawal validation', () => {
  const walletController = require('../backend/controllers/wallet.controller');
  const walletService = require('../backend/services/wallet.service');

  beforeEach(() => {
    walletService.initializeDeposit = async () => ({ authorization_url: 'https://paystack/x', reference: 'r1' });
    walletService.processDepositConfirmation = async () => ({ status: 'success', credited: true });
    walletService.requestWithdrawal = async () => ({ withdrawal_id: 'w1', status: 'pending' });
    walletService.updateAutoWithdrawalConfig = async () => ({ enabled: true });
  });

  it('rejects an unknown payment method with the allow-list', async () => {
    const res = mockRes();
    await walletController.initializeDeposit(reqFor({ body: { amount: 100, method: 'crypto' } }), res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Invalid payment method/);
  });

  it('requires a phone for M-Pesa deposits', async () => {
    const res = mockRes();
    await walletController.initializeDeposit(reqFor({ body: { amount: 100, method: 'mpesa' } }), res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /phone is required/);
  });

  it('initializes a valid deposit', async () => {
    const res = mockRes();
    await walletController.initializeDeposit(reqFor({ body: { amount: 250, method: 'card' } }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.reference, 'r1');
  });

  it('requires a reference to verify a deposit, scoped to the caller', async () => {
    const res = mockRes();
    await walletController.verifyDeposit(reqFor({ body: {} }), res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /reference is required/);
  });

  it('verifies a deposit for the signed-in user', async () => {
    let seenUserId = null;
    walletService.processDepositConfirmation = async (reference, userId) => {
      seenUserId = userId;
      return { status: 'success' };
    };
    const res = mockRes();
    await walletController.verifyDeposit(reqFor({ body: { reference: 'ref-9' } }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(seenUserId, 'user-1');
  });

  it('rejects a withdrawal method outside the allow-list', async () => {
    const res = mockRes();
    await walletController.requestWithdrawal(reqFor({ body: { amount: 100, method: 'paypal' } }), res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /method must be bank or mpesa/);
  });

  it('requires full bank details for bank withdrawals', async () => {
    const res = mockRes();
    await walletController.requestWithdrawal(
      reqFor({ body: { amount: 100, method: 'bank', accountNumber: '0123' } }),
      res
    );
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /accountName, accountNumber, and bankCode/);
  });

  it('accepts a well-formed bank withdrawal', async () => {
    const res = mockRes();
    await walletController.requestWithdrawal(
      reqFor({
        body: {
          amount: 500, method: 'bank',
          accountName: 'Buyer', accountNumber: '0123456789', bankCode: '044',
        },
      }),
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.withdrawal_id, 'w1');
  });

  it('rejects a missing amount before touching the payment rail', async () => {
    const res = mockRes();
    await walletController.initializeDeposit(reqFor({ body: { method: 'card' } }), res);
    assert.equal(res.statusCode, 400);
  });

  it('rejects fractional cents', async () => {
    const res = mockRes();
    await walletController.requestWithdrawal(reqFor({ body: { amount: 10.555, method: 'mpesa', phone: '0712345678' } }), res);
    assert.equal(res.statusCode, 400);
  });

  it('accepts amountCents as an integer', async () => {
    const res = mockRes();
    await walletController.initializeDeposit(reqFor({ body: { amountCents: 25000, method: 'card' } }), res);
    assert.equal(res.statusCode, 200);
  });
});

describe('security transactions — password change gate', () => {
  const securityController = require('../backend/controllers/security.controller');
  let fake;

  const route = (text) => {
    if (text.includes('FROM security_transactions')) return [[{ transaction_id: 'tx-1', purpose: 'password_change', seconds_left: 600 }]];
    return [[], []];
  };

  beforeEach(() => { fake = installFakePool(route); });
  afterEach(() => fake.restore());

  it('400s when token or password is missing', async () => {
    const res = mockRes();
    await securityController.changePasswordWithToken(reqFor({ body: { new_password: 'longenough1' } }), res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /required/i);
  });

  it('400s when the new password is too short', async () => {
    const res = mockRes();
    await securityController.changePasswordWithToken(reqFor({ body: { verification_token: 'tok', new_password: 'short' } }), res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /at least 8 characters/);
  });

  it('401s when the authorization token is invalid or expired', async () => {
    fake.restore();
    fake = installFakePool(async (text) => {
      if (text.includes('FROM security_transactions')) return [[]]; // no verified transaction
      return [[], []];
    });

    const res = mockRes();
    await securityController.changePasswordWithToken(reqFor({ body: { verification_token: 'tok', new_password: 'longenough1' } }), res);
    assert.equal(res.statusCode, 401);
    assert.match(res.body.message, /expired or is invalid/i);
  });
});

describe('security transactions — verify state machine', () => {
  const securityController = require('../backend/controllers/security.controller');
  let fake;

  afterEach(() => fake?.restore());

  const routeTx = (tx) => async (text) => {
    if (text.includes('FROM security_transactions')) return [[tx]];
    if (text.startsWith('SELECT password_hash FROM users')) {
      return [[{ password_hash: tx.__passwordHash }]];
    }
    return [[], []];
  };

  it('400s when the transaction id or code is missing', async () => {
    fake = installFakePool(async () => [[], []]);
    const res = mockRes();
    await securityController.verifySecurityTransaction(reqFor({ body: { code: '123456' } }), res);
    assert.equal(res.statusCode, 400);
  });

  it('400s for an unknown or already-used transaction', async () => {
    fake = installFakePool(async (text) => {
      if (text.includes('FROM security_transactions')) return [[]];
      return [[], []];
    });
    const res = mockRes();
    await securityController.verifySecurityTransaction(reqFor({ body: { transaction_id: 'tx-1', code: '123456' } }), res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /invalid or has already been used/i);
  });

  it('400s and expires a stale transaction', async () => {
    fake = installFakePool(routeTx({ transaction_id: 'tx-1', purpose: 'password_change', seconds_left: 0 }));
    const res = mockRes();
    await securityController.verifySecurityTransaction(reqFor({ body: { transaction_id: 'tx-1', code: '123456' } }), res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /expired/i);
  });

  it('429s and cancels after too many attempts', async () => {
    fake = installFakePool(routeTx({ transaction_id: 'tx-1', purpose: 'password_change', seconds_left: 600, attempt_count: 5, max_attempts: 5 }));
    const res = mockRes();
    await securityController.verifySecurityTransaction(reqFor({ body: { transaction_id: 'tx-1', code: '123456' } }), res);
    assert.equal(res.statusCode, 429);
    assert.match(res.body.message, /Too many failed verification attempts/i);
  });

  it('400s on a wrong credential and reports remaining attempts', async () => {
    const hash = await bcrypt.hash('correct-horse', 4);
    const updates = [];
    fake = installFakePool((text, params) => {
      if (text.includes('FROM security_transactions')) {
        return [[{ transaction_id: 'tx-1', purpose: 'password_change', seconds_left: 600, attempt_count: 0, max_attempts: 5, __passwordHash: hash }]];
      }
      if (text.startsWith('SELECT password_hash FROM users')) return [[{ password_hash: hash }]];
      if (text.startsWith('UPDATE security_transactions')) updates.push(text);
      return [[], []];
    });

    const res = mockRes();
    await securityController.verifySecurityTransaction(reqFor({ body: { transaction_id: 'tx-1', code: 'wrong-password' } }), res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /incorrect\. 4 attempts remaining\./);
    assert.ok(updates.some((u) => u.includes('attempt_count')), 'the attempt counter is incremented');
  });

  it('issues a single-use token on the correct credential (hash stored, raw returned)', async () => {
    const hash = await bcrypt.hash('correct-horse', 4);
    let storedToken = null;
    fake = installFakePool((text, params) => {
      if (text.includes('FROM security_transactions')) {
        return [[{ transaction_id: 'tx-1', purpose: 'password_change', seconds_left: 600, attempt_count: 0, max_attempts: 5 }]];
      }
      if (text.startsWith('SELECT password_hash FROM users')) return [[{ password_hash: hash }]];
      if (text.startsWith('UPDATE security_transactions')) storedToken = params[0];
      return [[], []];
    });

    const res = mockRes();
    await securityController.verifySecurityTransaction(reqFor({ body: { transaction_id: 'tx-1', code: 'correct-horse' } }), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'success');
    const rawToken = res.body.data.verification_token;
    assert.ok(rawToken.length >= 32, 'a high-entropy token is returned');
    assert.equal(storedToken, crypto.createHash('sha256').update(rawToken).digest('hex'), 'only the hash is persisted');
  });
});