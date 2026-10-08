// controllers/referral.controller.js
// Sparkle Production Referral & Attribution Controller
'use strict';

const ReferralService = require('../services/referral.service');
const logger = require('../utils/logger');

function extractUser(req) {
  if (!req.user) return null;
  return {
    user_id: req.user.userId || req.user.user_id || req.user.id,
    id: req.user.userId || req.user.user_id || req.user.id,
    username: req.user.username || 'user',
    name: req.user.name || req.user.username || 'User'
  };
}

/**
 * GET /api/referral/stats or GET /api/referrals/me
 * Returns the authenticated user's 100% real referral metrics
 */
exports.getStats = async (req, res) => {
  try {
    const user = extractUser(req);
    if (!user || !user.user_id) {
      return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }

    const stats = await ReferralService.getReferralStats(user, req);

    res.json({
      status: 'success',
      data: stats
    });
  } catch (err) {
    logger.error('[ReferralController] getStats error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch referral statistics' });
  }
};

/**
 * GET /api/referral/invite-link
 * Returns the authenticated user's canonical invite code and link
 */
exports.getInviteLink = async (req, res) => {
  try {
    const user = extractUser(req);
    if (!user || !user.user_id) {
      return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }

    const stats = await ReferralService.getReferralStats(user, req);

    res.json({
      status: 'success',
      data: {
        code: stats.referralCode,
        url: stats.referralLink
      }
    });
  } catch (err) {
    logger.error('[ReferralController] getInviteLink error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to generate invite link' });
  }
};

/**
 * GET /api/referral/leaderboard
 * Returns real top referrers and current user rank from database
 */
exports.getLeaderboard = async (req, res) => {
  try {
    const user = extractUser(req);
    const userId = user?.user_id || null;

    const leaderboard = await ReferralService.getLeaderboard(userId);

    res.json({
      status: 'success',
      data: leaderboard
    });
  } catch (err) {
    logger.error('[ReferralController] getLeaderboard error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch referral leaderboard' });
  }
};

/**
 * GET /api/referral/rewards
 * Returns current reward mechanics and active rules
 */
exports.getRewards = async (req, res) => {
  try {
    const rules = ReferralService.getRewardRules();

    res.json({
      status: 'success',
      data: {
        rules
      }
    });
  } catch (err) {
    logger.error('[ReferralController] getRewards error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch reward rules' });
  }
};

/**
 * GET /api/referral/history
 * Returns real referral history for authenticated user
 */
exports.getHistory = async (req, res) => {
  try {
    const user = extractUser(req);
    if (!user || !user.user_id) {
      return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }

    const history = await ReferralService.getReferralHistory(user.user_id);

    res.json({
      status: 'success',
      data: {
        history
      }
    });
  } catch (err) {
    logger.error('[ReferralController] getHistory error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch referral history' });
  }
};

/**
 * GET /api/referrals/validate/:code or GET /api/referrals/:code
 * Public endpoint: validates referral code and returns public inviter info
 */
exports.validateCode = async (req, res) => {
  try {
    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ status: 'error', message: 'Referral code is required' });
    }

    const result = await ReferralService.getPublicInviteInfo(code);
    if (!result.valid) {
      return res.status(404).json({
        status: 'error',
        valid: false,
        message: result.message || 'This invitation is no longer available.'
      });
    }

    res.json({
      status: 'success',
      valid: true,
      data: {
        code: result.code,
        referrer: result.referrer
      }
    });
  } catch (err) {
    logger.error('[ReferralController] validateCode error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to validate referral code' });
  }
};

/**
 * POST /api/referrals/click
 * Public endpoint: creates server-side click record and issues secure handoff token
 */
exports.recordClick = async (req, res) => {
  try {
    const { code, anonymousSessionId, platform, source } = req.body;
    if (!code) {
      return res.status(400).json({ status: 'error', message: 'Referral code is required' });
    }

    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
    const userAgent = req.headers['user-agent'] || '';

    const clickResult = await ReferralService.recordClick({
      code,
      anonymousSessionId,
      platform: platform || (req.headers['x-requested-with'] ? 'android' : 'web'),
      source: source || 'invite_link',
      userAgent,
      ip: clientIp,
      req
    });

    if (!clickResult.success) {
      return res.status(404).json({
        status: 'error',
        message: clickResult.message || 'Invalid or expired invitation'
      });
    }

    res.json({
      status: 'success',
      data: clickResult
    });
  } catch (err) {
    logger.error('[ReferralController] recordClick error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to record referral click' });
  }
};

/**
 * POST /api/referrals/resolve
 * Resolves a handoff token or fallback code
 */
exports.resolveHandoff = async (req, res) => {
  try {
    const { handoffToken, code } = req.body;
    if (!handoffToken && !code) {
      return res.status(400).json({ status: 'error', message: 'handoffToken or code required' });
    }

    const result = await ReferralService.resolveHandoff(handoffToken, code);
    if (!result.valid) {
      return res.status(404).json({
        status: 'error',
        valid: false,
        message: result.message || 'Referral could not be resolved'
      });
    }

    res.json({
      status: 'success',
      valid: true,
      data: result
    });
  } catch (err) {
    logger.error('[ReferralController] resolveHandoff error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to resolve referral handoff' });
  }
};

/**
 * POST /api/referrals/claim
 * Attaches a pending referral to the authenticated user (if not already attributed)
 */
exports.claimReferral = async (req, res) => {
  try {
    const user = extractUser(req);
    if (!user || !user.user_id) {
      return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }

    const { referralCode, handoffToken } = req.body;
    if (!referralCode && !handoffToken) {
      return res.status(400).json({ status: 'error', message: 'referralCode or handoffToken required' });
    }

    const result = await ReferralService.attributeSignup({
      newUserId: user.user_id,
      referralCode,
      handoffToken,
      attributionMethod: handoffToken ? 'handoff_token' : 'manual_claim'
    });

    if (!result.attributed) {
      if (result.reason === 'self_referral') {
        return res.status(400).json({ status: 'error', message: 'You cannot use your own referral code.' });
      }
      if (result.reason === 'already_referred') {
        return res.status(400).json({ status: 'error', message: "You're already on Sparkle with an attributed referral." });
      }
      return res.status(400).json({ status: 'error', message: 'Unable to claim this referral code.' });
    }

    res.json({
      status: 'success',
      message: 'Referral attributed successfully!',
      data: result
    });
  } catch (err) {
    logger.error('[ReferralController] claimReferral error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to claim referral' });
  }
};

/**
 * POST /api/referrals/manual
 * Manual referral code fallback input
 */
exports.manualCode = async (req, res) => {
  try {
    const user = extractUser(req);
    if (!user || !user.user_id) {
      return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }

    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ status: 'error', message: 'Valid referral code required' });
    }

    const result = await ReferralService.attributeSignup({
      newUserId: user.user_id,
      referralCode: code.trim(),
      attributionMethod: 'manual_code'
    });

    if (!result.attributed) {
      if (result.reason === 'self_referral') {
        return res.status(400).json({ status: 'error', message: 'You cannot use your own referral code.' });
      }
      if (result.reason === 'already_referred') {
        return res.status(400).json({ status: 'error', message: "You already have an attributed referrer." });
      }
      return res.status(400).json({ status: 'error', message: 'Invalid or expired referral code.' });
    }

    res.json({
      status: 'success',
      message: 'Referral code applied successfully!',
      data: result
    });
  } catch (err) {
    logger.error('[ReferralController] manualCode error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to apply referral code' });
  }
};
