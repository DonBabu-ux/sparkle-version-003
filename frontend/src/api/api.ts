import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to handle common errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Check if path is NOT /auth/login to avoid infinite loops
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      // Handle unauthorized (redirect to login)
      localStorage.removeItem('sparkleToken');
      localStorage.removeItem('user-storage'); // Zustand persisted state
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

import type { LoginCredentials, SignupData } from '../types/auth';

export const authApi = {
  login: (credentials: LoginCredentials) => api.post('/auth/login', credentials),
  signup: (userData: SignupData) => api.post('/auth/signup', userData),
  validateToken: () => api.get('/auth/validate'),
  logout: () => api.post('/auth/logout'),
};

export default api;

