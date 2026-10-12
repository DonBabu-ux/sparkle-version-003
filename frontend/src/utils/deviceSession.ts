// Per-account "this device" session id (from login/verify-2fa responses)
// so Settings > Devices can badge the current session as "Current".
// Keyed by user id: the store supports multiple accounts on one device, and
// one global key would badge the wrong session after account switches.
const KEY = 'sparkle_session_ids';

type SessionMap = Record<string, string>;

function read(): SessionMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function recordDeviceSession(userId?: string | null, sessionId?: string | null): void {
  if (!userId || !sessionId) return;
  try {
    const map = read();
    map[userId] = sessionId;
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch { /* storage unavailable */ }
}

export function forgetDeviceSession(userId?: string | null): void {
  if (!userId) return;
  try {
    const map = read();
    if (userId in map) {
      delete map[userId];
      localStorage.setItem(KEY, JSON.stringify(map));
    }
  } catch { /* storage unavailable */ }
}

export function getDeviceSessionId(userId?: string | null): string | null {
  if (!userId) return null;
  try {
    return read()[userId] || null;
  } catch {
    return null;
  }
}
