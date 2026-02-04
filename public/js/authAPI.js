/**
 * authAPI.js - Authentication Utility for Sparkle
 * Handles SQL-backed authentication and session management.
 */

const AuthAPI = {
    baseUrl: '/api/auth',

    async login(username, password) {
        try {
            const response = await fetch(`${this.baseUrl}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // Save token and user info
            this.setSession(data.token, data.user);
            return data;
        } catch (error) {
            console.error('Login Error:', error.message);
            throw error;
        }
    },

    async signup(userData) {
        try {
            // userData should contain { name, username, email, password, campus, major, year }
            const response = await fetch(`${this.baseUrl}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Signup failed');
            }

            return data;
        } catch (error) {
            console.error('Signup Error:', error.message);
            throw error;
        }
    },

    async logout() {
        // Since we use JWT, we just need to clear local storage
        this.clearSession();
        // Optionally notify the server
        try {
            const token = localStorage.getItem('sparkleToken');
            if (token) {
                await fetch(`${this.baseUrl}/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
            }
        } catch (e) {
            console.warn('Logout notification failed:', e);
        }
        window.location.href = '/login';
    },

    async forgotPassword(email) {
        try {
            const response = await fetch(`${this.baseUrl}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            return await response.json();
        } catch (error) {
            console.error('Forgot Password Error:', error.message);
            throw error;
        }
    },

    async uploadMedia(file) {
        const token = localStorage.getItem('sparkleToken');
        if (!token) throw new Error('Not authenticated');

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
            if (!response.ok) throw new Error(data.error || 'Upload failed');
            return data.url;
        } catch (error) {
            console.error('Upload Error:', error.message);
            throw error;
        }
    },

    setSession(token, user) {
        localStorage.setItem('sparkleToken', token);
        localStorage.setItem('sparkleUser', JSON.stringify({
            ...user,
            loggedIn: true
        }));
    },

    clearSession() {
        localStorage.removeItem('sparkleToken');
        localStorage.removeItem('sparkleUser');
    },

    getSession() {
        const user = localStorage.getItem('sparkleUser');
        const token = localStorage.getItem('sparkleToken');
        return {
            user: user ? JSON.parse(user) : null,
            token
        };
    },

    isLoggedIn() {
        const { user, token } = this.getSession();
        return !!(user && token && user.loggedIn);
    }
};

window.AuthAPI = AuthAPI;
