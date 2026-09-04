import axios from 'axios';
import { useUserStore } from '../store/userStore';

import { EnvironmentService } from '../services/EnvironmentService';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || EnvironmentService.getApiBaseUrl(),
  withCredentials: true,
  // NOTE: Do NOT set a default Content-Type here.
  // Axios will automatically set 'application/json' for plain objects
  // and let the browser set 'multipart/form-data; boundary=...' for FormData.
  // Locking it to 'application/json' breaks all file/media uploads.
});

// CSRF state
let csrfToken: string | null = null;
let csrfFetchAttempted = false;

const fetchCsrfToken = async (): Promise<string | null> => {
  if (csrfToken) return csrfToken;
  if (csrfFetchAttempted) return null;
  csrfFetchAttempted = true;
  try {
    const { data } = await axios.get(`${api.defaults.baseURL}/csrf-token`, { 
      withCredentials: true,
      timeout: 2000
    });
    csrfToken = data?.csrfToken || 'sparkle_csrf_disabled';
    return csrfToken;
  } catch (_err) {
    csrfToken = 'sparkle_csrf_disabled';
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

// Interceptor to handle common errors and refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle Network Errors (like ERR_CONNECTION_REFUSED) - bypass retries for login/auth to respond immediately
    const isAuthUrl = originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/auth/signup');
    if (!error.response && originalRequest && !isAuthUrl) {
      // If it's a network error and we haven't retried this specific request yet
      if (!originalRequest._networkRetry || originalRequest._networkRetry < 2) {
        originalRequest._networkRetry = (originalRequest._networkRetry || 0) + 1;
        console.warn(`🌐 Network error on ${originalRequest.url}, retrying... (${originalRequest._networkRetry})`);
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

