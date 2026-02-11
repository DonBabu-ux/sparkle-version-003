/**
 * authAPI.js - Authentication Utility for Sparkle
 * Production-ready with retry logic, error handling, and debugging
 * Browser-compatible version (no ES6 modules)
 */

const AuthAPI = {
    baseUrl: '/api/auth',
    maxRetries: 2,
    retryDelay: 1000,

    /**
     * Enhanced fetch with retry logic and timeout
     */
    async _fetchWithRetry(url, options, retries = this.maxRetries) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                credentials: 'include'
            });

            clearTimeout(timeoutId);

            // If server error, retry
            if (response.status >= 500 && retries > 0) {
                console.warn(`⚠️ Server error ${response.status}, retrying... (${retries} left)`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this._fetchWithRetry(url, options, retries - 1);
            }

            return response;
        } catch (error) {
            clearTimeout(timeoutId);

            // Network error, retry
            if (retries > 0 && error.name !== 'AbortError') {
                console.warn(`⚠️ Network error, retrying... (${retries} left)`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this._fetchWithRetry(url, options, retries - 1);
            }

            throw error;
        }
    },

    /**
     * Validate API response
     */
    _validateResponse(response, data) {
        if (!response.ok) {
            const error = new Error(data.message || data.error || `HTTP ${response.status}: Request failed`);
            error.status = response.status;
            error.data = data;
            throw error;
        }

        // For login/signup, ensure we have token and user
        if (response.url.includes('/login') || response.url.includes('/signup')) {
            if (!data.token || !data.user) {
                throw new Error('Invalid server response: missing token or user data');
            }
        }

        return data;
    },

    /**
     * Login user with enhanced error handling
     */
    async login(username, password) {
        const startTime = Date.now();

        console.groupCollapsed('🔐 Login Request');
        console.log('Username:', username);
        console.log('Timestamp:', new Date().toISOString());

        try {
            // Input validation
            if (!username?.trim() || !password) {
                throw new Error('Username and password are required');
            }

            // Make login request
            const response = await this._fetchWithRetry(`${this.baseUrl}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            // Validate response
            const validatedData = this._validateResponse(response, data);

            // Save session
            this.setSession(validatedData.token, validatedData.user);

            const responseTime = Date.now() - startTime;
            console.log(`✅ Login successful in ${responseTime}ms`);
            console.groupEnd();

            return validatedData;

        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.error(`❌ Login failed after ${responseTime}ms:`, {
                name: error.name,
                message: error.message,
                status: error.status,
                data: error.data
            });

            // Handle specific error cases
            let userMessage = 'Login failed';

            if (error.name === 'AbortError') {
                userMessage = 'Request timeout. Please check your connection.';
            } else if (error.status === 401) {
                userMessage = 'Invalid username or password';
            } else if (error.status === 429) {
                userMessage = 'Too many attempts. Please try again later.';
            } else if (error.status >= 500) {
                userMessage = 'Server error. Please try again.';
            } else if (error.message.includes('Network')) {
                userMessage = 'Network error. Please check your connection.';
            }

            const enhancedError = new Error(userMessage);
            enhancedError.originalError = error;
            enhancedError.isAuthError = true;

            console.groupEnd();
            throw enhancedError;
        }
    },

    /**
     * Signup user with validation
     */
    async signup(userData) {
        try {
            // Required fields
            const required = ['name', 'username', 'email', 'password', 'campus'];
            const missing = required.filter(field => !userData[field]);

            if (missing.length > 0) {
                throw new Error(`Missing required fields: ${missing.join(', ')}`);
            }

            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(userData.email)) {
                throw new Error('Invalid email format');
            }

            // Password strength
            if (userData.password.length < 6) {
                throw new Error('Password must be at least 6 characters');
            }

            const response = await this._fetchWithRetry(`${this.baseUrl}/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            const validatedData = this._validateResponse(response, data);

            // Auto-login after signup
            if (validatedData.token && validatedData.user) {
                this.setSession(validatedData.token, validatedData.user);
            }

            return validatedData;

        } catch (error) {
            console.error('❌ Signup failed:', error.message);

            // Handle specific errors
            let userMessage = 'Signup failed';

            if (error.status === 409) {
                userMessage = 'User with this email or username already exists';
            } else if (error.status === 400) {
                userMessage = error.data?.message || 'Invalid registration data';
            }

            const enhancedError = new Error(userMessage);
            enhancedError.originalError = error;

            console.groupEnd();
            throw enhancedError;
        }
    },

    /**
     * Logout with server notification
     */
    async logout() {

        try {
            const token = localStorage.getItem('sparkleToken');
            if (token) {
                // Notify server
                await fetch(`${this.baseUrl}/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }).catch(e => {
                    console.warn('Logout notification failed (non-critical):', e.message);
                });
            }
        } catch (e) {
            console.warn('Logout cleanup error:', e);
        } finally {
            // Always clear local session
            this.clearSession();

            // Redirect to login
            window.location.href = '/login';
        }
    },

    /**
     * Forgot password request
     */
    async forgotPassword(email) {

        try {
            if (!email?.trim()) {
                throw new Error('Email is required');
            }

            const response = await fetch(`${this.baseUrl}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || data.error || 'Password reset request failed');
            }

            console.log('✅ Password reset email sent');
            return data;

        } catch (error) {
            console.error('❌ Forgot password failed:', error.message);
            throw error;
        }
    },

    /**
     * Upload media file
     */
    async uploadMedia(file) {

        const token = this.getSession().token;
        if (!token) {
            throw new Error('Not authenticated. Please login again.');
        }

        // Validate file
        if (!file || !(file instanceof File)) {
            throw new Error('Invalid file');
        }

        // Check file size (5MB limit)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new Error('File size must be less than 5MB');
        }

        const formData = new FormData();
        formData.append('media', file);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Upload failed: ${response.status}`);
            }

            if (!data.url) {
                throw new Error('Invalid response: missing file URL');
            }

            console.log('✅ Upload successful:', data.url);
            return data.url;

        } catch (error) {
            console.error('❌ Upload failed:', error.message);
            throw error;
        }
    },

    /**
     * Session management
     */
    setSession(token, user) {
        try {
            localStorage.setItem('sparkleToken', token);
            localStorage.setItem('sparkleUser', JSON.stringify({
                ...user,
                loggedIn: true,
                sessionStart: new Date().toISOString()
            }));

            // Dispatch event for other parts of the app
            window.dispatchEvent(new CustomEvent('authChange', {
                detail: { isLoggedIn: true, user }
            }));
        } catch (error) {
            console.error('Failed to save session:', error);
            throw new Error('Failed to save login session');
        }
    },

    clearSession() {
        try {
            localStorage.removeItem('sparkleToken');
            localStorage.removeItem('sparkleUser');

            // Dispatch logout event
            window.dispatchEvent(new CustomEvent('authChange', {
                detail: { isLoggedIn: false, user: null }
            }));
        } catch (error) {
            console.error('Failed to clear session:', error);
        }
    },

    getSession() {
        try {
            const userJson = localStorage.getItem('sparkleUser');
            const token = localStorage.getItem('sparkleToken');

            if (!userJson || !token) {
                return { user: null, token: null };
            }

            const user = JSON.parse(userJson);

            // Check if token is expired (optional - usually validated server-side)
            if (user.sessionStart) {
                const sessionAge = Date.now() - new Date(user.sessionStart).getTime();
                const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

                if (sessionAge > maxAge) {
                    console.warn('Session expired');
                    this.clearSession();
                    return { user: null, token: null };
                }
            }

            return { user, token };
        } catch (error) {
            console.error('Failed to get session:', error);
            this.clearSession();
            return { user: null, token: null };
        }
    },

    isLoggedIn() {
        const { user, token } = this.getSession();
        return !!(user && token && user.loggedIn);
    },

    /**
     * Get current user (safe method)
     */
    getCurrentUser() {
        const { user } = this.getSession();
        return user;
    },

    /**
     * Get auth headers for API requests
     */
    getAuthHeaders() {
        const { token } = this.getSession();
        return token ? {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        } : {};
    },

    /**
     * Validate current session with server
     */
    async validateSession() {
        const { token } = this.getSession();

        if (!token) {
            return { valid: false, reason: 'No token' };
        }

        try {
            const response = await fetch(`${this.baseUrl}/validate`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                return { valid: true };
            } else {
                this.clearSession();
                return { valid: false, reason: 'Server rejected token' };
            }
        } catch (error) {
            console.warn('Session validation failed:', error.message);
            // Don't clear session on network errors
            return { valid: true, warning: 'Could not validate with server' };
        }
    },

    /**
     * Refresh token (if implemented on server)
     */
    async refreshToken() {
        const { token } = this.getSession();

        if (!token) {
            throw new Error('No token to refresh');
        }

        try {
            const response = await fetch(`${this.baseUrl}/refresh`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();

            if (response.ok && data.token) {
                this.setSession(data.token, data.user || this.getCurrentUser());
                return data.token;
            } else {
                throw new Error(data.error || 'Token refresh failed');
            }
        } catch (error) {
            console.error('Token refresh failed:', error);
            throw error;
        }
    }
};

// Make available globally - SIMPLIFIED VERSION
window.AuthAPI = AuthAPI;

// Auto-validate session on page load
window.addEventListener('load', () => {
    if (AuthAPI.isLoggedIn()) {
        AuthAPI.validateSession().then(result => {
            if (!result.valid) {
                console.log('Session invalidated:', result.reason);
            }
        });
    }
});
