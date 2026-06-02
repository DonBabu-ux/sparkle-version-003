export class EnvironmentService {
  static isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  static isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  static getApiBaseUrl(): string {
    const isNative = window.location.protocol === 'capacitor:';
    const LIVE_URL = 'https://sparkle-version-003-1-f4v3.onrender.com/api';

    if (isNative) {
      return LIVE_URL;
    }

    if (this.isDevelopment()) {
      // Standard localhost endpoint for web development
      const isLocalhost = 
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.') ||
        window.location.hostname.startsWith('172.');
      
      return isLocalhost ? 'http://localhost:3000/api' : LIVE_URL;
    }

    return LIVE_URL;
  }
}
