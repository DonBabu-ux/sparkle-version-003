// Same-origin defaults: prod builds hit the Render backend directly; the Vite
// dev server proxies /api and /socket.io to 127.0.0.1:3000 (vite.config.ts).
// Override with VITE_API_URL / VITE_SOCKET_URL when the API lives elsewhere.
const DEFAULT_API_URL = '/api';

export class EnvironmentService {
  static isDevelopment(): boolean {
    return import.meta.env.DEV;
  }

  static isProduction(): boolean {
    return import.meta.env.PROD;
  }

  static getApiBaseUrl(): string {
    return import.meta.env.VITE_API_URL || DEFAULT_API_URL;
  }

  static getSocketUrl(): string {
    return import.meta.env.VITE_SOCKET_URL ||
      (typeof window !== 'undefined' ? window.location.origin : '');
  }
}
