import { useUserStore } from '../store/userStore';
import { refreshTokenOnce } from './tokenRefresh';
import { logger } from '../utils/logger';

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp) return false;
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < (now + 10); // 10-second buffer
  } catch (e) {
    return true;
  }
}

export const AuthService = {
  getAccessToken(): string | null {
    return useUserStore.getState().token;
  },

  getRefreshToken(): string | null {
    return useUserStore.getState().refreshToken;
  },

  async refreshAccessToken(): Promise<string> {
    // Single-flight refresh shared with api.ts interceptors and socketService
    // (concurrent refreshes with one refresh token invalidate each other).
    return refreshTokenOnce();
  },

  async getFreshToken(): Promise<string> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated. Please log in.');
    }

    if (isTokenExpired(token)) {
      logger.log('[AuthService] Token expired or close to expiration. Refreshing...');
      return this.refreshAccessToken();
    }

    return token;
  }
};
