import { Capacitor } from '@capacitor/core';
import { ServerFailoverManager } from './ServerFailoverManager';

// Fallback relative path for local dev proxy
const DEFAULT_API_URL = '/api';

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
    // In local dev with Vite proxy, use relative /api
    if (this.isDevelopment() && !this.isNative()) {
      return DEFAULT_API_URL;
    }
    // On native mobile or production web, return active failover server API base
    return ServerFailoverManager.getActiveApiBase();
  }

  static getSocketUrl(): string {
    if (this.isDevelopment() && !this.isNative()) {
      return typeof window !== 'undefined' ? window.location.origin : '';
    }
    // On native mobile or production web, return active failover server origin
    return ServerFailoverManager.getActiveOrigin();
  }

  static getActiveOrigin(): string {
    return ServerFailoverManager.getActiveOrigin();
  }
}

