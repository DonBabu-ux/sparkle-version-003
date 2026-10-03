import { appLockStorage } from './appLockStorage';

const STORAGE_KEY_PIN_ENABLED = 'sparkle_app_pin_enabled';
const STORAGE_KEY_PIN_HASH = 'sparkle_app_pin_hash';
const STORAGE_KEY_PIN_SALT = 'sparkle_app_pin_salt';
const STORAGE_KEY_LOCK_TIMEOUT = 'sparkle_app_lock_timeout'; // in minutes: 0 = immediately, 1, 5, 15, 60
const STORAGE_KEY_FAILED_ATTEMPTS = 'sparkle_app_pin_failed_attempts';
const STORAGE_KEY_LOCKOUT_UNTIL = 'sparkle_app_pin_lockout_until';

// Helper: Convert buffer to hex string
function bufToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Convert hex string to Uint8Array
function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Derive a strong key verifier from PIN and Salt using PBKDF2 with 100,000 iterations
async function deriveVerifier(pin: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return bufToHex(derivedBits);
}

class AppLockService {
  private isUnlocked: boolean = false;
  private lastActivity: number = Date.now();
  private listeners: Set<(locked: boolean) => void> = new Set();

  constructor() {
    this.initActivityListener();
  }

  private initActivityListener() {
    if (typeof window === 'undefined') return;

    // Track user interaction to update last active timestamp
    const updateActivity = () => {
      this.lastActivity = Date.now();
    };

    window.addEventListener('touchstart', updateActivity, { passive: true });
    window.addEventListener('click', updateActivity, { passive: true });
    window.addEventListener('keydown', updateActivity, { passive: true });

    // Handle visibility changes (e.g. app sent to background)
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'hidden') {
        this.lastActivity = Date.now();
      } else if (document.visibilityState === 'visible') {
        const shouldLock = await this.checkShouldLockOnResume();
        if (shouldLock) {
          this.isUnlocked = false;
          this.notifyListeners(true);
        }
      }
    });
  }

  public subscribe(cb: (locked: boolean) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notifyListeners(locked: boolean) {
    this.listeners.forEach(cb => cb(locked));
  }

  public async isPinEnabled(): Promise<boolean> {
    const value = await appLockStorage.get(STORAGE_KEY_PIN_ENABLED);
    return value === 'true';
  }

  public async getLockTimeout(): Promise<number> {
    const value = await appLockStorage.get(STORAGE_KEY_LOCK_TIMEOUT);
    return value ? parseInt(value, 10) : 0; // Default: 0 (immediately upon leaving app)
  }

  public async setLockTimeout(minutes: number): Promise<void> {
    await appLockStorage.set(STORAGE_KEY_LOCK_TIMEOUT, minutes.toString());
  }

  public isCurrentlyUnlocked(): boolean {
    return this.isUnlocked;
  }

  public async checkShouldLockOnResume(): Promise<boolean> {
    const enabled = await this.isPinEnabled();
    if (!enabled) return false;

    const timeoutMinutes = await this.getLockTimeout();
    if (timeoutMinutes === 0) {
      // 0 means lock immediately whenever user leaves or resumes
      return true;
    }

    const elapsedMs = Date.now() - this.lastActivity;
    return elapsedMs >= timeoutMinutes * 60 * 1000;
  }

  public async getLockoutTimeRemaining(): Promise<number> {
    const value = await appLockStorage.get(STORAGE_KEY_LOCKOUT_UNTIL);
    if (!value) return 0;
    const until = parseInt(value, 10);
    const diff = Math.ceil((until - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  }

  public async setupPin(pin: string, timeoutMinutes: number = 0): Promise<boolean> {
    // Strictly enforce exactly 6 digits everywhere
    if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      throw new Error('PIN must be exactly 6 digits.');
    }

    // Generate 16 bytes cryptographically secure random salt
    const salt = new Uint8Array(16);
    window.crypto.getRandomValues(salt);

    const hash = await deriveVerifier(pin, salt);

    await appLockStorage.set(STORAGE_KEY_PIN_ENABLED, 'true');
    await appLockStorage.set(STORAGE_KEY_PIN_SALT, bufToHex(salt.buffer));
    await appLockStorage.set(STORAGE_KEY_PIN_HASH, hash);
    await appLockStorage.set(STORAGE_KEY_LOCK_TIMEOUT, timeoutMinutes.toString());
    await appLockStorage.set(STORAGE_KEY_FAILED_ATTEMPTS, '0');
    await appLockStorage.remove(STORAGE_KEY_LOCKOUT_UNTIL);

    this.isUnlocked = true;
    this.lastActivity = Date.now();
    this.notifyListeners(false);

    return true;
  }

  public async verifyPin(pin: string): Promise<{ success: boolean; error?: string; lockoutRemaining?: number }> {
    // Strictly verify exactly 6 digits
    if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      return { success: false, error: 'PIN must be exactly 6 digits.' };
    }

    const lockout = await this.getLockoutTimeRemaining();
    if (lockout > 0) {
      return { success: false, error: `Too many requests. Try again in ${lockout}s`, lockoutRemaining: lockout };
    }

    const saltHex = await appLockStorage.get(STORAGE_KEY_PIN_SALT);
    const storedHash = await appLockStorage.get(STORAGE_KEY_PIN_HASH);

    if (!saltHex || !storedHash) {
      return { success: false, error: 'No PIN is configured on this device.' };
    }

    const salt = hexToBuf(saltHex);
    const derived = await deriveVerifier(pin, salt);

    if (derived === storedHash) {
      // Success: reset attempts
      await appLockStorage.set(STORAGE_KEY_FAILED_ATTEMPTS, '0');
      this.isUnlocked = true;
      this.lastActivity = Date.now();
      this.notifyListeners(false);
      return { success: true };
    } else {
      // Increment failed attempts
      const attemptsVal = await appLockStorage.get(STORAGE_KEY_FAILED_ATTEMPTS);
      const attempts = (attemptsVal ? parseInt(attemptsVal, 10) : 0) + 1;
      await appLockStorage.set(STORAGE_KEY_FAILED_ATTEMPTS, attempts.toString());

      if (attempts >= 5) {
        // 30 seconds lockout after 5 failed attempts
        const lockoutUntil = Date.now() + 30 * 1000;
        await appLockStorage.set(STORAGE_KEY_LOCKOUT_UNTIL, lockoutUntil.toString());
        return { success: false, error: 'Too many requests. Locked for 30 seconds.', lockoutRemaining: 30 };
      }

      return { success: false, error: `Incorrect PIN. ${5 - attempts} attempts remaining.` };
    }
  }

  public async changePin(currentPin: string, newPin: string): Promise<boolean> {
    const verification = await this.verifyPin(currentPin);
    if (!verification.success) {
      throw new Error(verification.error || 'Current PIN is incorrect.');
    }
    return this.setupPin(newPin);
  }

  public async resetPinWithToken(newPin: string, timeoutMinutes: number = 0): Promise<boolean> {
    if (!newPin || newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      throw new Error('New PIN must be exactly 6 digits.');
    }

    // Completely wipe old local PIN verifier
    await appLockStorage.remove(STORAGE_KEY_PIN_ENABLED);
    await appLockStorage.remove(STORAGE_KEY_PIN_SALT);
    await appLockStorage.remove(STORAGE_KEY_PIN_HASH);
    await appLockStorage.remove(STORAGE_KEY_FAILED_ATTEMPTS);
    await appLockStorage.remove(STORAGE_KEY_LOCKOUT_UNTIL);

    // Setup new 6-digit PIN locally
    return this.setupPin(newPin, timeoutMinutes);
  }

  public async disablePin(currentPin: string): Promise<boolean> {
    const verification = await this.verifyPin(currentPin);
    if (!verification.success) {
      throw new Error(verification.error || 'Current PIN is incorrect.');
    }

    await appLockStorage.remove(STORAGE_KEY_PIN_ENABLED);
    await appLockStorage.remove(STORAGE_KEY_PIN_SALT);
    await appLockStorage.remove(STORAGE_KEY_PIN_HASH);
    await appLockStorage.remove(STORAGE_KEY_FAILED_ATTEMPTS);
    await appLockStorage.remove(STORAGE_KEY_LOCKOUT_UNTIL);

    this.isUnlocked = true;
    this.notifyListeners(false);
    return true;
  }

  public lockNow(): void {
    this.isUnlocked = false;
    this.notifyListeners(true);
  }
}

export const appLockService = new AppLockService();

