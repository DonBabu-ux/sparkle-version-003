// tests/referral.test.js
// Comprehensive Integration Tests for Sparkle Production Referral System
'use strict';

require('dotenv').config();
const crypto = require('crypto');
const pool = require('../config/database');
const ReferralService = require('../services/referral.service');

async function runReferralTests() {
  console.log('🧪 Starting Sparkle Referral System Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Generate test users in database
  const userAId = crypto.randomUUID();
  const userBId = crypto.randomUUID();
  const userCId = crypto.randomUUID();

  try {
    // 0. Setup: Clean up any old test users
    await pool.query('DELETE FROM users WHERE username IN (?, ?, ?)', ['test_referrer_a', 'test_referee_b', 'test_referee_c']);

    // Create User A (Referrer)
    await pool.query(
      'INSERT INTO users (user_id, name, username, email, password_hash, user_type) VALUES (?, ?, ?, ?, ?, ?)',
      [userAId, 'Referrer Alice', 'test_referrer_a', `alice_${Date.now()}@test.sparkle`, 'hashed_pw', 'student']
    );

    // Create User B (New Referee)
    await pool.query(
      'INSERT INTO users (user_id, name, username, email, password_hash, user_type) VALUES (?, ?, ?, ?, ?, ?)',
      [userBId, 'Referee Bob', 'test_referee_b', `bob_${Date.now()}@test.sparkle`, 'hashed_pw', 'student']
    );

    // Create User C (Referee for second test)
    await pool.query(
      'INSERT INTO users (user_id, name, username, email, password_hash, user_type) VALUES (?, ?, ?, ?, ?, ?)',
      [userCId, 'Referee Charlie', 'test_referee_c', `charlie_${Date.now()}@test.sparkle`, 'hashed_pw', 'student']
    );

    console.log('1️⃣ Test: Referral Code Generation');
    const codeRecord = await ReferralService.getOrCreateUserReferralCode({ user_id: userAId, username: 'test_referrer_a' });
    assert(Boolean(codeRecord?.code), `Generated referral code: ${codeRecord.code}`);
    assert(codeRecord.code.startsWith('TEST'), `Code uses user prefix: ${codeRecord.code}`);

    console.log('\n2️⃣ Test: Public Referral Code Validation');
    const validInfo = await ReferralService.getPublicInviteInfo(codeRecord.code);
    assert(validInfo.valid === true, 'Valid code returns valid=true');
    assert(validInfo.referrer.username === 'test_referrer_a', 'Returns correct inviter username');

    const invalidInfo = await ReferralService.getPublicInviteInfo('NONEXISTENT_999');
    assert(invalidInfo.valid === false, 'Invalid code returns valid=false');

    console.log('\n3️⃣ Test: Link Click & Cryptographic Handoff Token');
    const clickResult = await ReferralService.recordClick({
      code: codeRecord.code,
      platform: 'android',
      source: 'whatsapp_share',
      userAgent: 'Mozilla/5.0 Android SparkleTest'
    });
    assert(clickResult.success === true, 'Recorded click successfully');
    assert(Boolean(clickResult.handoffToken), `Issued opaque handoff token (length ${clickResult.handoffToken.length})`);
    assert(Boolean(clickResult.canonicalUrl), `Generated canonical URL: ${clickResult.canonicalUrl}`);

    console.log('\n4️⃣ Test: Handoff Token Resolution');
    const resolved = await ReferralService.resolveHandoff(clickResult.handoffToken);
    assert(resolved.valid === true, 'Resolved handoff token successfully');
    assert(resolved.code === codeRecord.code, 'Resolved to correct referral code');
    assert(resolved.referrer.id === userAId, 'Resolved to correct referrer user ID');

    console.log('\n5️⃣ Test: Self-Referral Prevention');
    const selfRef = await ReferralService.attributeSignup({
      newUserId: userAId, // User A trying to refer User A
      referralCode: codeRecord.code,
      attributionMethod: 'manual_code'
    });
    assert(selfRef.attributed === false, 'Blocked self-referral attribution');
    assert(selfRef.reason === 'self_referral', `Correct rejection reason: ${selfRef.reason}`);

    console.log('\n6️⃣ Test: Successful Referral Attribution (A -> B)');
    const attrResult = await ReferralService.attributeSignup({
      newUserId: userBId,
      referralCode: codeRecord.code,
      handoffToken: clickResult.handoffToken,
      attributionMethod: 'handoff_token'
    });
    assert(attrResult.attributed === true, 'Attributed User B to User A successfully');
    assert(attrResult.referrerUserId === userAId, 'Referrer user ID matches User A');

    console.log('\n7️⃣ Test: Duplicate Referral Prevention (B cannot be referred again)');
    const duplicateAttr = await ReferralService.attributeSignup({
      newUserId: userBId,
      referralCode: codeRecord.code,
      attributionMethod: 'manual_code'
    });
    assert(duplicateAttr.attributed === false, 'Blocked duplicate referral for User B');
    assert(duplicateAttr.reason === 'already_referred', `Correct rejection reason: ${duplicateAttr.reason}`);

    console.log('\n8️⃣ Test: Attribution Immutability (Second referrer C cannot overwrite)');
    // Try to attribute B to C
    const codeCRecord = await ReferralService.getOrCreateUserReferralCode({ user_id: userCId, username: 'test_referee_c' });
    const overwriteAttempt = await ReferralService.attributeSignup({
      newUserId: userBId,
      referralCode: codeCRecord.code,
      attributionMethod: 'manual_code'
    });
    assert(overwriteAttempt.attributed === false, 'Blocked overwriting existing referrer');
    assert(overwriteAttempt.reason === 'already_referred', 'Existing referral remains immutable');

    console.log('\n9️⃣ Test: Referral Stats Calculation (Real DB Data)');
    const statsA = await ReferralService.getReferralStats({ user_id: userAId, username: 'test_referrer_a' });
    assert(statsA.successfulSignups >= 1, `Real successful signups count >= 1 (got ${statsA.successfulSignups})`);
    assert(statsA.totalEarnings >= 60, `Real earnings credited to wallet (got KES ${statsA.totalEarnings})`);
    assert(statsA.referralCode === codeRecord.code, `Stats contains correct canonical code`);

    console.log('\n🔟 Test: Referral History (Real DB Records)');
    const historyA = await ReferralService.getReferralHistory(userAId);
    assert(historyA.length >= 1, `History returns real records (length: ${historyA.length})`);
    const historyItem = historyA.find(h => h.username === 'test_referee_b');
    assert(Boolean(historyItem), 'History contains User B');
    assert(historyItem?.status === 'Rewarded' || historyItem?.status === 'Active', `Status is valid: ${historyItem?.status}`);

    console.log('\n1️⃣1️⃣ Test: Leaderboard Ranking');
    const leaderboard = await ReferralService.getLeaderboard(userAId);
    assert(Array.isArray(leaderboard.topReferrers), 'Top referrers is an array');
    const leaderA = leaderboard.topReferrers.find(l => l.username === 'test_referrer_a');
    assert(Boolean(leaderA), 'User A is listed on real leaderboard');
    assert(leaderboard.currentUser?.rank >= 1, `Current user rank calculated accurately: #${leaderboard.currentUser?.rank}`);

    console.log('\n1️⃣2️⃣ Test: Prevention of Double Reward on Same Referral');
    // Calling qualifyReferral again on B
    const secondQual = await ReferralService.qualifyReferral(userBId);
    assert(secondQual.qualified === false, 'Blocked double qualification for same referral');

    console.log('\n=============================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================\n');

  } catch (err) {
    console.error('Test Suite encountered error:', err);
    failed++;
  } finally {
    // Cleanup test records
    try {
      await pool.query('DELETE FROM referral_rewards WHERE referrer_user_id IN (?, ?, ?)', [userAId, userBId, userCId]);
      await pool.query('DELETE FROM referrals WHERE referrer_user_id IN (?, ?, ?) OR referred_user_id IN (?, ?, ?)', [userAId, userBId, userCId, userAId, userBId, userCId]);
      await pool.query('DELETE FROM referral_clicks WHERE referrer_user_id IN (?, ?, ?)', [userAId, userBId, userCId]);
      await pool.query('DELETE FROM referral_codes WHERE user_id IN (?, ?, ?)', [userAId, userBId, userCId]);
      await pool.query('DELETE FROM users WHERE user_id IN (?, ?, ?)', [userAId, userBId, userCId]);
      console.log('🧹 Cleaned up test database records.');
    } catch (cleanErr) {
      console.warn('Cleanup warning:', cleanErr.message);
    }
    process.exit(failed > 0 ? 1 : 0);
  }
}

if (require.main === module) {
  runReferralTests();
}

module.exports = runReferralTests;
