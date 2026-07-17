import { useUserStore } from '../store/userStore';
import axios from 'axios';
import api from '../api/api';

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

let refreshPromise: Promise<string> | null = null;

export const AuthService = {
  getAccessToken(): string | null {
    return useUserStore.getState().token;
  },

  getRefreshToken(): string | null {
    return useUserStore.getState().refreshToken;
  },

  async refreshAccessToken(): Promise<string> {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        useUserStore.getState().logout();
        throw new Error('No refresh token available. Please login.');
      }

      try {
        const baseURL = api.defaults.baseURL || '/api';
        const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
        const newToken = data.token;
        const newRefreshToken = data.refreshToken;
        
        useUserStore.getState().setToken(newToken, newRefreshToken);
        return newToken;
      } catch (err) {
        useUserStore.getState().logout();
        throw new Error('Session expired. Please log in again.');
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },

  async getFreshToken(): Promise<string> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated. Please log in.');
    }

    if (isTokenExpired(token)) {
      console.log('[AuthService] Token expired or close to expiration. Refreshing...');
      return this.refreshAccessToken();
    }

    return token;
  }
};
