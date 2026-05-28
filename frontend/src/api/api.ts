import axios from 'axios';
import { useUserStore } from '../store/userStore';

const isLocalhost = 
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.') ||
  window.location.hostname.startsWith('172.');

const isNative = window.location.protocol === 'capacitor:';

// URLs
const LIVE_URL = 'https://sparkle-version-003-1-f4v3.onrender.com/api';
const LOCAL_URL = 'http://localhost:3000/api';

// Logic: Use live server for APK (isNative) and localhost/env for localhost
let defaultBaseURL = isNative ? LIVE_URL : (isLocalhost ? LOCAL_URL : LIVE_URL);

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || defaultBaseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// CSRF state
let csrfToken: string | null = null;

const fetchCsrfToken = async (retries = 3): Promise<string | null> => {
  try {
    const { data } = await axios.get(`${api.defaults.baseURL}/csrf-token`, { withCredentials: true });
    csrfToken = data.csrfToken;
    return csrfToken;
  } catch (err) {
    if (retries > 0) {
      console.warn(`CSRF fetch failed, retrying... (${retries} left)`);
      await new Promise(r => setTimeout(r, 1000));
      return fetchCsrfToken(retries - 1);
    }
    console.error('Failed to fetch CSRF token after retries:', err);
    return null;
  }
};

console.log('🚀 Sparkle API initialized at:', api.defaults.baseURL);

// Interceptor to add auth token, CSRF token, and device info
api.interceptors.request.use(
  async (config) => {
    // Prefer token from user store; fallback to localStorage if not present
    let token = useUserStore.getState().token;
    if (!token) {
      token = localStorage.getItem('accessToken') || null;
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add CSRF token for state-changing requests
    if (['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase() || '')) {
      if (!csrfToken) {
        await fetchCsrfToken();
      }
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    // Add Device ID for multi-device detection
    config.headers['x-device-id'] = localStorage.getItem('sparkle_device_id') || 'unknown';
    
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Interceptor to handle common errors and refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle Network Errors (like ERR_CONNECTION_REFUSED)
    if (!error.response && originalRequest) {
      // If it's a network error and we haven't retried this specific request yet
      if (!originalRequest._networkRetry || originalRequest._networkRetry < 3) {
        originalRequest._networkRetry = (originalRequest._networkRetry || 0) + 1;
        console.warn(`🌐 Network error on ${originalRequest.url}, retrying... (${originalRequest._networkRetry})`);
        await new Promise(r => setTimeout(r, 1000 * originalRequest._networkRetry));
        return api(originalRequest);
      }
    }

    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/auth/login')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = useUserStore.getState().refreshToken;
      if (!refreshToken) {
        useUserStore.getState().logout();
        return Promise.reject(error);
      }

      // New retry wrapper for token refresh
      const MAX_REFRESH_RETRIES = 3;
      let attempt = 0;
      const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
      
      while (attempt < MAX_REFRESH_RETRIES) {
        try {
          const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken });
          const newToken = data.token;
          const newRefreshToken = data.refreshToken;
          useUserStore.getState().setToken(newToken, newRefreshToken);
          processQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          isRefreshing = false;
          return api(originalRequest);
        } catch (refreshError: any) {
          attempt++;
          if (attempt >= MAX_REFRESH_RETRIES) {
            processQueue(refreshError, null);
            useUserStore.getState().logout();
            isRefreshing = false;
            return Promise.reject(refreshError);
          }
          // Backoff: Attempt 1 -> 1s, Attempt 2 -> 3s
          const backoff = attempt === 1 ? 1000 : 3000;
          console.warn(`Refresh token attempt ${attempt} failed, retrying in ${backoff}ms`);
          await delay(backoff);
        }
      }
      isRefreshing = false;
    }
    return Promise.reject(error);
  }
);

import type { LoginCredentials, SignupData } from '../types/auth';

export const authApi = {
  login: (credentials: LoginCredentials) => api.post('/auth/login', credentials),
  signup: (userData: SignupData) => api.post('/auth/signup', userData),
  validateToken: () => api.get('/auth/validate'),
  logout: (refreshToken?: string) => api.post('/auth/logout', { refreshToken }),
};

export const postsApi = {
  logAction: (postId: string, action_type: string, duration?: number) =>
    api.post(`/posts/${postId}/action`, { action_type, duration }),
};

export default api;

