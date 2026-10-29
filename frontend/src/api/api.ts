import axios from 'axios';
import { useUserStore } from '../store/userStore';

import { EnvironmentService } from '../services/EnvironmentService';
import { ServerFailoverManager } from '../services/ServerFailoverManager';
import { refreshTokenOnce } from '../services/tokenRefresh';
import { adoptServerToken } from '../utils/tokenHeaderSync';

const api = axios.create({
  baseURL: EnvironmentService.getApiBaseUrl(),
  withCredentials: true,
  timeout: 25000,
});

// Update axios baseURL whenever active failover server changes
ServerFailoverManager.onServerChange((newServer) => {
  api.defaults.baseURL = EnvironmentService.getApiBaseUrl();
  csrfToken = null;
  csrfFetchAttempted = false;
  logger.log(`[API] Updated default baseURL to: ${api.defaults.baseURL}`);
});

// CSRF state
let csrfToken: string | null = null;
let csrfFetchAttempted = false;

// Admin elevation session (second password). Short-lived, in-memory only —
// sessionStorage so a tab refresh keeps it but closing the browser drops it.
const ADMIN_SESSION_KEY = 'sparkle_admin_session';
export const getAdminSession = (): string | null => sessionStorage.getItem(ADMIN_SESSION_KEY);
export const setAdminSession = (token: string) => sessionStorage.setItem(ADMIN_SESSION_KEY, token);
export const clearAdminSession = () => sessionStorage.removeItem(ADMIN_SESSION_KEY);

const fetchCsrfToken = async (): Promise<string | null> => {
  if (csrfToken) return csrfToken;
  if (csrfFetchAttempted) return null;
  csrfFetchAttempted = true;
  try {
    const { data } = await axios.get(`${EnvironmentService.getApiBaseUrl()}/csrf-token`, { 
      withCredentials: true,
      timeout: 3000
    });
    csrfToken = data?.csrfToken || 'sparkle_csrf_disabled';
    return csrfToken;
  } catch (_err) {
    csrfToken = 'sparkle_csrf_disabled';
    return null;
  }
};

logger.log('Sparkle API initialized at:', api.defaults.baseURL);

// Interceptor to add auth token, CSRF token, and device info
api.interceptors.request.use(
  async (config) => {
    // Dynamically guarantee baseURL always matches the currently active server
    config.baseURL = EnvironmentService.getApiBaseUrl();

    // Token comes from the user store
    const token = useUserStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Admin elevation: send the session token on every /admin/* call so the
    // dashboard is authorized by the second password, not just the role.
    if (config.url?.includes('/admin') || config.url?.includes('/security/transaction')) {
      const adminSession = getAdminSession();
      if (adminSession) {
        config.headers['x-admin-session'] = adminSession;
      }
    }

    // Add CSRF token for state-changing requests (except auth routes like login/signup to prevent delays)
    const isAuthRequest = config.url?.includes('/auth/login') || config.url?.includes('/auth/signup') || config.url?.includes('/auth/refresh');
    if (['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase() || '')) {
      if (!csrfToken && !isAuthRequest && !csrfFetchAttempted) {
        await fetchCsrfToken();
      }
      if (csrfToken && csrfToken !== 'sparkle_csrf_disabled') {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    // Add Device ID for multi-device detection
    config.headers['x-device-id'] = localStorage.getItem('sparkle_device_id') || 'unknown';

    // If the body is FormData, remove any Content-Type override so the browser
    // can set the correct multipart/form-data boundary automatically.
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

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

/**
 * Checks if an error qualifies for server failover:
 * - Connection refused / DNS failure / Network error (no response)
 * - 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout
 */
const isFailoverCandidateError = (error: any): boolean => {
  if (!error.response) {
    // Network error / timeout / abort
    const msg = String(error.message || '').toLowerCase();
    const code = String(error.code || '').toLowerCase();
    return (
      code === 'econnaborted' ||
      code === 'econnrefused' ||
      code === 'enotfound' ||
      code === 'err_network' ||
      code === 'etimedout' ||
      msg.includes('network error') ||
      msg.includes('timeout') ||
      msg.includes('failed to fetch')
    );
  }
  const status = error.response.status;
  return status === 502 || status === 503 || status === 504;
};

// Interceptor to handle common errors and refresh token
api.interceptors.response.use(
  (response) => {
    // H26: renewal rides on every authenticated response past half-life
    adoptServerToken(response.headers);
    return response;
  },
  async (error) => {
    // Same adoption on 4xx/5xx where auth still ran (401s carry no renewal)
    if (error.response) adoptServerToken(error.response.headers);
    const originalRequest = error.config;

    // ── AUTOMATIC FAILOVER RETRY ──
    if (originalRequest && !originalRequest._failoverRetried && isFailoverCandidateError(error)) {
      originalRequest._failoverRetried = true;
      const currentActive = ServerFailoverManager.getActiveServer();
      const secondary = ServerFailoverManager.getSecondaryServer();

      if (!ServerFailoverManager.isQuarantined(secondary.id)) {
        logger.warn(`🚨 Request to ${currentActive.id} failed (${error.response?.status || error.message}). Attempting failover to ${secondary.id}...`);

        // Switch the active server
        ServerFailoverManager.switchActiveServer(secondary.id, `Request error on ${originalRequest.url}: ${error.message || error.response?.status}`);

        // Update the failed request config with the new base URL
        originalRequest.baseURL = secondary.apiBase;

        // If absolute URL was previously resolved in originalRequest, adjust it
        if (originalRequest.url && originalRequest.url.startsWith('http')) {
          originalRequest.url = originalRequest.url.replace(currentActive.origin, secondary.origin);
        }

        // Wait briefly for secondary connection
        await new Promise((r) => setTimeout(r, 400));
        return api(originalRequest);
      }
    }

    // Handle Network Errors (like ERR_CONNECTION_REFUSED) - bypass retries for login/auth to respond immediately
    const isAuthUrl = originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/auth/signup');
    if (!error.response && originalRequest && !isAuthUrl) {
      if (!originalRequest._networkRetry || originalRequest._networkRetry < 2) {
        originalRequest._networkRetry = (originalRequest._networkRetry || 0) + 1;
        logger.warn(`❌ Network error on ${originalRequest.url}, retrying... (${originalRequest._networkRetry})`);
        await new Promise(r => setTimeout(r, 500 * originalRequest._networkRetry));
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

      // Single-flight refresh (shared with AuthService/socketService) + retry on transient failures
      const MAX_REFRESH_RETRIES = 3;
      let attempt = 0;
      const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
      
      while (attempt < MAX_REFRESH_RETRIES) {
        try {
          const newToken = await refreshTokenOnce();
          processQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          isRefreshing = false;
          return api(originalRequest);
        } catch (refreshError: any) {
          attempt++;
          const sessionDead = !useUserStore.getState().isAuthenticated;
          if (attempt >= MAX_REFRESH_RETRIES || sessionDead) {
            processQueue(refreshError, null);
            if (sessionDead) useUserStore.getState().logout();
            isRefreshing = false;
            return Promise.reject(refreshError);
          }
          // Backoff: Attempt 1 -> 1s, Attempt 2 -> 3s
          const backoff = attempt === 1 ? 1000 : 3000;
          logger.warn(`Refresh token attempt ${attempt} failed, retrying in ${backoff}ms`);
          await delay(backoff);
        }
      }
      isRefreshing = false;
    }
    return Promise.reject(error);
  }
);

import type { LoginCredentials, SignupData } from '../types/auth';
import { logger } from '../utils/logger';

export const authApi = {
  login: (credentials: LoginCredentials) => api.post('/auth/login', credentials),
  signup: (userData: SignupData) => api.post('/auth/signup', userData),
  validateToken: () => api.get('/auth/validate'),
  logout: (refreshToken?: string) => api.post('/auth/logout', { refreshToken }),
  checkUsername: (username: string) => api.get(`/auth/check-username?username=${encodeURIComponent(username)}`),
  checkEmail: (email: string) => api.get(`/auth/check-email?email=${encodeURIComponent(email)}`),
};

export const onboardingApi = {
  getStatus: () => api.get('/onboarding/status'),
  getPopularUsers: () => api.get('/onboarding/popular-users'),
  getRecommendations: (category?: string, page = 1, limit = 10) => 
    api.get('/onboarding/recommendations', { params: { category, page, limit } }),
  follow: (userIds: string[]) => api.post('/onboarding/follow', { userIds }),
  saveInterests: (interests: string[]) => api.post('/onboarding/interests', { interests }),
  complete: () => api.post('/onboarding/complete'),
};

export const postsApi = {
  logAction: (postId: string, action_type: string, duration?: number) =>
    api.post(`/posts/${postId}/action`, { action_type, duration }),
};

export const notificationsApi = {
  getNotifications: (params?: { since?: string; page?: number; limit?: number; category?: string; priority?: string; unreadOnly?: boolean }) =>
    api.get('/notifications', { params }),
  markRead: (id: string) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
};

export default api;

