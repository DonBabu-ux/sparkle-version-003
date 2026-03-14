// utils.js

/**
 * Debounce function to limit execution frequency
 * @param {Function} func 
 * @param {number} wait 
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Returns a human-readable "time ago" string
 * @param {string} dateStr 
 */
export function timeAgo(dateStr) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Recently';
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

/**
 * Formats a timestamp (placeholder if not in DashboardAPI)
 * @param {string} timestamp 
 */
export function formatTimestamp(timestamp) {
    if (window.DashboardAPI && typeof window.DashboardAPI.formatTimestamp === 'function') {
        return window.DashboardAPI.formatTimestamp(timestamp);
    }
    return new Date(timestamp).toLocaleString();
}
/**
 * Returns the current user data from window or localStorage
 */
export function getCurrentUser() {
    if (window.currentUser && Object.keys(window.currentUser).length > 0) {
        return window.currentUser;
    }
    try {
        const stored = localStorage.getItem('currentUser');
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        return {};
    }
}
