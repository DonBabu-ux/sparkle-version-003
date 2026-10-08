// frontend/src/services/referralAttribution.ts
// Client-side attribution state manager for Sparkle referrals
// Ensures referral attribution survives APK download, installation, app closure, and onboarding.

const STORAGE_KEY = 'sparkle_pending_referral';
const EXPIRY_DAYS = 7;

export interface PendingReferral {
  referralCode: string;
  handoffToken?: string;
  capturedAt: number;
  referrer?: {
    id?: string;
    username: string;
    name?: string;
    avatar_url?: string | null;
  };
}

/**
 * Capture and persist pending referral attribution
 */
export function capturePendingReferral(referral: {
  referralCode: string;
  handoffToken?: string;
  referrer?: {
    id?: string;
    username: string;
    name?: string;
    avatar_url?: string | null;
  };
}): void {
  if (!referral.referralCode) return;

  const data: PendingReferral = {
    referralCode: referral.referralCode.trim().toUpperCase(),
    handoffToken: referral.handoffToken || undefined,
    capturedAt: Date.now(),
    referrer: referral.referrer
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log('[ReferralAttribution] Pending referral saved:', data.referralCode);
  } catch (e) {
    console.warn('[ReferralAttribution] Failed to save pending referral to localStorage:', e);
  }
}

/**
 * Retrieve pending referral if valid and not expired
 */
export function getPendingReferral(): PendingReferral | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data: PendingReferral = JSON.parse(raw);
    const maxAgeMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    if (Date.now() - data.capturedAt > maxAgeMs) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return data;
  } catch (e) {
    return null;
  }
}

/**
 * Clear pending referral once registration attribution is completed
 */
export function clearPendingReferral(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // Ignore
  }
}

/**
 * Extract referral code or handoff from URL query or path
 * Supports: /invite/:code, /signup?ref=:code, ?handoff=token
 */
export function extractReferralFromUrl(urlString: string): { referralCode?: string; handoffToken?: string } {
  try {
    const url = new URL(urlString, window.location.origin);

    // 1. Path check: /invite/:code
    const inviteMatch = url.pathname.match(/\/invite\/([A-Za-z0-9_-]+)/i);
    if (inviteMatch && inviteMatch[1]) {
      return { referralCode: inviteMatch[1].toUpperCase() };
    }

    // 2. Query check: ?ref=CODE or ?code=CODE
    const refParam = url.searchParams.get('ref') || url.searchParams.get('code');
    const handoffParam = url.searchParams.get('handoff');

    return {
      referralCode: refParam ? refParam.toUpperCase() : undefined,
      handoffToken: handoffParam || undefined
    };
  } catch {
    return {};
  }
}
