// api-client.js

// Assuming DashboardAPI is already globally available or injected
// This module provides a clean interface for other modules

export const apiClient = window.DashboardAPI || {};

export function getCurrentUser() {
    return JSON.parse(localStorage.getItem('currentUser') || '{}');
}

export function getCurrentToken() {
    return localStorage.getItem('sparkleToken');
}

export function formatTimestamp(ts) {
    if (apiClient.formatTimestamp) return apiClient.formatTimestamp(ts);
    return new Date(ts).toLocaleString();
}
