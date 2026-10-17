import { Capacitor } from '@capacitor/core';

// Same-origin defaults: prod builds hit the Render backend directly; the Vite
// dev server proxies /api and /socket.io to 127.0.0.1:3000 (vite.config.ts).
// Override with VITE_API_URL / VITE_SOCKET_URL when the API lives elsewhere.
const DEFAULT_API_URL = '/api';
// Absolute backend origin. Used whenever we run inside the native APK webview:
// there the origin is localhost/capacitor://, so a relative /api or an
// origin-derived socket URL would resolve against localhost and every
// request (including login) would fail.
const PROD_ORIGIN = 'https://sparkle-version-003-1-f4v3.onrender.com';
const PROD_API_URL = `${PROD_ORIGIN}/api`;

export class EnvironmentService {
  static isDevelopment(): boolean {
    return import.meta.env.DEV;
  }

  static isProduction(): boolean {
    return import.meta.env.PROD;
  }

  static isNative(): boolean {
    try {
      return Capacitor.isNativePlatform();
    } catch {
      return false;
    }
  }

  static getApiBaseUrl(): string {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    // Native builds have no same-origin backend — always use the absolute URL.
    return this.isNative() ? PROD_API_URL : DEFAULT_API_URL;
  }

  static getSocketUrl(): string {
    if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
    if (this.isNative()) return PROD_ORIGIN;
    return typeof window !== 'undefined' ? window.location.origin : '';
  }
}
