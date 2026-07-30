// Production-safe URL: always resolves from env vars at build time.
// During `vite build --mode production`, Vite injects .env.production values,
// so the APK never contains localhost references.
const RENDER_API_URL = 'https://sparkle-version-003-1-f4v3.onrender.com/api';
const RENDER_SOCKET_URL = 'https://sparkle-version-003-1-f4v3.onrender.com';

export class EnvironmentService {
  static isDevelopment(): boolean {
    return import.meta.env.DEV;
  }

  static isProduction(): boolean {
    return import.meta.env.PROD;
  }

  static getApiBaseUrl(): string {
    return import.meta.env.VITE_API_URL || RENDER_API_URL;
  }

  static getSocketUrl(): string {
    return import.meta.env.VITE_SOCKET_URL || RENDER_SOCKET_URL;
  }
}
