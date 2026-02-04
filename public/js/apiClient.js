// apiClient.js - Sparkle API Client for Frontend-Backend Integration
class SparkleAPI {
    constructor() {
        this.baseUrl = '/api';
        this.token = localStorage.getItem('sparkleToken');
    }

    // ============ CORE REQUEST METHOD ============
    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Request failed with status ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error(`❌ API Error (${endpoint}):`, error.message);
            throw error;
        }
    }

    // ============ HELPER METHODS ============
    async get(endpoint) {
        return await this.request(endpoint, { method: 'GET' });
    }

    async post(endpoint, data) {
        return await this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async put(endpoint, data) {
        return await this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async delete(endpoint) {
        return await this.request(endpoint, { method: 'DELETE' });
    }

    // ============ AUTHENTICATION ============
    async signup(userData) {
        const response = await this.request('/auth/signup', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        return response;
    }

    async login(username, password) {
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        if (response.token) {
            this.token = response.token;
            localStorage.setItem('sparkleToken', response.token);
            localStorage.setItem('currentUser', JSON.stringify(response.user));
        }

        return response;
    }

    async logout() {
        await this.request('/auth/logout', { method: 'POST' });
        this.token = null;
        localStorage.removeItem('sparkleToken');
        localStorage.removeItem('currentUser');
    }

    // ============ USER MANAGEMENT ============
    async getUser(userId) {
        return await this.request(`/users/${userId}`);
    }

    async updateProfile(profileData) {
        const response = await this.request('/users/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });

        // Sync local storage if update was successful
        if (response.status === 'success' && response.user) {
            this.syncCurrentUser(response.user);
        }

        return response;
    }

    syncCurrentUser(user) {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const updatedUser = { ...currentUser, ...user };
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        // Also update any global state if needed
        window.user = updatedUser;
    }

    getCurrentUser() {
        return JSON.parse(localStorage.getItem('currentUser') || '{}');
    }

    async searchUsers(query, campus = null) {
        const params = new URLSearchParams({ q: query });
        if (campus) params.append('campus', campus);
        return await this.request(`/users/search?${params}`);
    }

    async followUser(userId) {
        return await this.request(`/users/follow/${userId}`, {
            method: 'POST'
        });
    }

    // ============ POSTS & FEED ============
    async getFeed() {
        return await this.request('/posts/feed');
    }

    async createPost(postData) {
        return await this.request('/posts', {
            method: 'POST',
            body: JSON.stringify(postData)
        });
    }

    async sparkPost(postId) {
        return await this.request(`/posts/${postId}/spark`, {
            method: 'POST'
        });
    }

    async deletePost(postId) {
        return await this.request(`/posts/${postId}`, {
            method: 'DELETE'
        });
    }

    // ============ AFTERGLOW (STORIES) ============
    async createStory(storyData) {
        return await this.request('/stories', {
            method: 'POST',
            body: JSON.stringify(storyData)
        });
    }

    async getActiveStories() {
        return await this.request('/stories/active');
    }

    // ============ MOMENTS ============
    async uploadMoment(momentData) {
        return await this.request('/moments', {
            method: 'POST',
            body: JSON.stringify(momentData)
        });
    }

    async getMomentsStream() {
        return await this.request('/moments/stream');
    }

    // ============ MESSAGING ============
    async getChats() {
        return await this.request('/messages/chats');
    }

    async sendMessage(messageData) {
        return await this.request('/messages', {
            method: 'POST',
            body: JSON.stringify(messageData)
        });
    }

    // ============ MARKETPLACE ============
    async createListing(listingData) {
        return await this.request('/market/listings', {
            method: 'POST',
            body: JSON.stringify(listingData)
        });
    }

    async getListings(category = null, campus = null) {
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        if (campus) params.append('campus', campus);
        const query = params.toString();
        return await this.request(`/market/listings${query ? '?' + query : ''}`);
    }

    async markAsSold(listingId) {
        return await this.request(`/market/${listingId}/sold`, {
            method: 'PUT'
        });
    }

    // ============ GROUPS ============
    async createGroup(groupData) {
        return await this.request('/groups', {
            method: 'POST',
            body: JSON.stringify(groupData)
        });
    }

    async joinGroup(groupId) {
        return await this.request(`/groups/${groupId}/join`, {
            method: 'POST'
        });
    }

    async getCampusGroups() {
        return await this.request('/groups/campus');
    }

    // ============ CONFESSIONS ============
    async submitConfession(confessionData) {
        return await this.request('/confessions', {
            method: 'POST',
            body: JSON.stringify(confessionData)
        });
    }

    async getBestConfessions() {
        return await this.request('/confessions/best');
    }

    // ============ SYSTEM ============
    async healthCheck() {
        return await this.request('/health');
    }
}

// Create and export singleton instance
// Create and export singleton instance
const apiClient = new SparkleAPI();
window.apiClient = apiClient;
