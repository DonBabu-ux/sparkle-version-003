// public/js/firebase-realtime.js
// This runs entirely in the browser - works perfectly on Vercel serverless!

// Import Firebase
import { initializeApp } from 'firebase/app';
import {
    getDatabase,
    ref,
    set,
    update,
    onValue,
    onDisconnect,
    serverTimestamp,
    push,
    query,
    limitToLast,
    orderByChild,
    equalTo
} from 'firebase/database';
import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged
} from 'firebase/auth';

class SparkleRealtime {
    constructor() {
        this.userData = null;
        this.db = null;
        this.auth = null;
        this.isAuthorized = false; // Start false, set true after successful auth
        this.isAuthInitialized = false;
        this.subscriptions = new Map();
        this.typingTimeouts = new Map();
        this.presenceInterval = null;

        // Initialize from window variables (set by EJS)
        this.initFromWindow();
    }

    initFromWindow() {
        if (window.currentUser) {
            this.userId = window.currentUserId;
            this.userData = window.currentUser;
        }

        if (window.firebaseConfig && Object.keys(window.firebaseConfig).length > 0) {
            try {
                const app = initializeApp(window.firebaseConfig, 'sparkle-realtime');
                this.db = getDatabase(app);
                this.auth = getAuth(app);
                console.log('🔥 Firebase Realtime Database initialized');

                // Solution 4: Ensure Authenticated
                this.ensureAuthenticated().then(() => {
                    console.log('🔐 Firebase Anonymous Auth successful');
                    this.isAuthorized = true;
                    if (this.userId) {
                        this.setupPresence();
                    }
                }).catch(err => {
                    if (err.message.includes('admin-restricted-operation')) {
                        console.warn('ℹ️ Firebase: Anonymous Auth is disabled in your Firebase Console. Real-time features will be limited.');
                    } else {
                        console.warn('⚠️ Firebase Auth failed (Real-time features limited):', err.message);
                    }
                    this.isAuthorized = false;
                });
            } catch (error) {
                console.error('Failed to initialize Firebase:', error);
            }
        } else {
            console.warn('⚠️ Firebase config missing in window.firebaseConfig');
        }
    }

    async ensureAuthenticated() {
        if (!this.auth) return Promise.reject('Auth not initialized');

        return new Promise((resolve, reject) => {
            onAuthStateChanged(this.auth, (user) => {
                if (user) {
                    this.isAuthInitialized = true;
                    resolve(user);
                } else {
                    signInAnonymously(this.auth)
                        .then(() => {
                            this.isAuthInitialized = true;
                            // Resolve will happen via onAuthStateChanged
                        })
                        .catch(reject);
                }
            });

            // Timeout after 5 seconds
            setTimeout(() => {
                if (!this.isAuthInitialized) reject(new Error('Auth timeout'));
            }, 5000);
        });
    }

    // ============= USER PRESENCE (ONLINE/OFFLINE) =============

    setupPresence() {
        if (!this.db || !this.userId) return;

        const userStatusRef = ref(this.db, `status/${this.userId}`);
        const connectedRef = ref(this.db, '.info/connected');

        // Listen for connection state
        onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                // We're connected (or reconnected)!

                // Set up disconnect hook
                onDisconnect(userStatusRef).set({
                    online: false,
                    lastSeen: serverTimestamp(),
                    lastSeenISO: new Date().toISOString()
                });

                // Set user as online
                set(userStatusRef, {
                    online: true,
                    lastSeen: serverTimestamp(),
                    lastSeenISO: new Date().toISOString(),
                    name: this.userData?.name || this.userData?.username || `User ${this.userId.substring(0, 6)}`,
                    avatar: this.userData?.avatar || '/images/default-avatar.png',
                    campus: this.userData?.campus || '',
                    lastActive: 'just now'
                }).then(() => {
                    console.log(`👤 ${this.userId} is online`);
                }).catch(err => {
                    if (err.message.includes('PERMISSION_DENIED')) {
                        console.warn('⚠️ Firebase: Permission denied for presence. Please check your security rules.');
                    } else {
                        console.error('Firebase setupPresence error:', err);
                    }
                });

                // Also store in users collection for easy lookup
                const userRef = ref(this.db, `users/${this.userId}`);
                update(userRef, {
                    online: true,
                    lastSeen: serverTimestamp(),
                    name: this.userData?.name || this.userData?.username,
                    campus: this.userData?.campus
                }).catch(() => { }); // Silent catch for user metadata
            }
        });

        // Set up periodic heartbeat (every 30 seconds)
        this.presenceInterval = setInterval(() => {
            if (this.userId) {
                const statusRef = ref(this.db, `status/${this.userId}`);
                update(statusRef, {
                    lastSeen: serverTimestamp(),
                    lastSeenISO: new Date().toISOString(),
                    heartbeat: Date.now()
                }).catch(() => { }); // Silent catch for heartbeat
            }
        }, 30000);
    }

    // Watch a user's online status
    watchUserStatus(userId, callback) {
        if (!this.db) return null;

        const statusRef = ref(this.db, `status/${userId}`);

        const unsubscribe = onValue(statusRef, (snapshot) => {
            const status = snapshot.val();

            if (status) {
                // Check if status is recent (within last 2 minutes)
                const isOnline = status.online === true;
                const lastSeen = status.lastSeenISO || status.lastSeen;

                callback({
                    userId,
                    online: isOnline,
                    lastSeen,
                    ...status
                });
            } else {
                callback({
                    userId,
                    online: false,
                    lastSeen: null
                });
            }
        });

        const subId = `status_${userId}_${Date.now()}`;
        this.subscriptions.set(subId, unsubscribe);

        return subId;
    }

    updateLocalFallback(isOnline) {
        try {
            const sparkleUser = JSON.parse(localStorage.getItem('sparkleUser') || '{}');
            sparkleUser.online = isOnline;
            sparkleUser.lastActive = new Date().toISOString();
            localStorage.setItem('sparkleUser', JSON.stringify(sparkleUser));
            console.log('📦 Fallback: Updated presence in localStorage');
        } catch (e) {
            console.warn('Failed to update local presence fallback');
        }
    }

    // Watch multiple users at once
    watchMultipleUsers(userIds, callback) {
        if (!this.db || !userIds.length) return null;

        const results = {};
        let completed = 0;

        userIds.forEach(userId => {
            this.watchUserStatus(userId, (status) => {
                results[userId] = status;
                completed++;

                if (completed === userIds.length) {
                    callback(results);
                }
            });
        });
    }

    // ============= TYPING INDICATORS =============

    // User started typing in a chat
    startTyping(chatId) {
        if (!this.db || !this.userId || !this.isAuthorized) return;

        // Clear existing timeout
        this.stopTyping(chatId);

        const typingRef = ref(this.db, `typing/${chatId}/${this.userId}`);

        // Set typing status
        set(typingRef, {
            typing: true,
            name: this.userData?.name || this.userData?.username || `User ${this.userId.substring(0, 6)}`,
            userId: this.userId,
            timestamp: serverTimestamp(),
            timestampISO: new Date().toISOString()
        }).catch(err => {
            console.warn('Firebase: Failed to set typing status:', err.message);
        });

        // Auto-stop after 3 seconds
        const timeoutId = setTimeout(() => {
            this.stopTyping(chatId);
        }, 3000);

        this.typingTimeouts.set(chatId, timeoutId);
    }

    // User stopped typing
    stopTyping(chatId) {
        if (!this.db || !this.userId) return;

        // Clear timeout
        if (this.typingTimeouts.has(chatId)) {
            clearTimeout(this.typingTimeouts.get(chatId));
            this.typingTimeouts.delete(chatId);
        }

        const typingRef = ref(this.db, `typing/${chatId}/${this.userId}`);

        // Set typing to false (or remove the entry)
        return set(typingRef, {
            typing: false,
            timestamp: serverTimestamp()
        }).catch(() => { });
    }

    // Watch typing status in a chat
    watchTyping(chatId, callback) {
        if (!this.db) return null;

        const typingRef = ref(this.db, `typing/${chatId}`);

        const unsubscribe = onValue(typingRef, (snapshot) => {
            const data = snapshot.val() || {};
            const now = Date.now();
            const typingUsers = [];

            Object.entries(data).forEach(([userId, info]) => {
                // Skip current user
                if (userId === this.userId) return;

                // Check if user is actively typing
                if (info.typing === true) {
                    // Check if typing is recent (within last 3 seconds)
                    const timestamp = info.timestamp;
                    let isRecent = true;

                    if (timestamp) {
                        // Handle Firebase timestamp (seconds since epoch)
                        if (typeof timestamp === 'object' && timestamp.seconds) {
                            isRecent = (now - (timestamp.seconds * 1000)) < 3000;
                        } else if (typeof timestamp === 'number') {
                            isRecent = (now - timestamp) < 3000;
                        }
                    }

                    if (isRecent) {
                        typingUsers.push({
                            userId,
                            name: info.name || `User ${userId.substring(0, 6)}`,
                            ...info
                        });
                    }
                }
            });

            callback(typingUsers);
        });

        const subId = `typing_${chatId}_${Date.now()}`;
        this.subscriptions.set(subId, unsubscribe);

        return subId;
    }

    // ============= CHAT MESSAGES =============

    // Send a chat message
    sendMessage(chatId, text) {
        if (!this.db || !this.userId || !text.trim() || !this.isAuthorized) return null;

        const messagesRef = ref(this.db, `chats/${chatId}/messages`);
        const newMessageRef = push(messagesRef);
        const messageId = newMessageRef.key;

        const message = {
            id: messageId,
            text: text.trim(),
            senderId: this.userId,
            senderName: this.userData?.name || this.userData?.username || 'Unknown',
            senderAvatar: this.userData?.avatar || '/images/default-avatar.png',
            timestamp: serverTimestamp(),
            timestampISO: new Date().toISOString(),
            read: false
        };

        set(newMessageRef, message).catch(err => {
            console.error('Firebase: Failed to send message:', err.message);
        });

        // Also update chat metadata
        const chatMetaRef = ref(this.db, `chats/${chatId}/metadata`);
        update(chatMetaRef, {
            lastMessage: text.trim(),
            lastMessageId: messageId,
            lastMessageTime: serverTimestamp(),
            lastSenderId: this.userId,
            lastSenderName: message.senderName
        }).catch(() => { });

        // Stop typing when message is sent
        this.stopTyping(chatId);

        return messageId;
    }

    // Watch messages in a chat
    watchMessages(chatId, callback, limit = 50) {
        if (!this.db) return null;

        const messagesRef = ref(this.db, `chats/${chatId}/messages`);
        const messagesQuery = query(messagesRef, limitToLast(limit));

        const unsubscribe = onValue(messagesQuery, (snapshot) => {
            const data = snapshot.val() || {};
            const messages = Object.entries(data)
                .map(([id, msg]) => ({ id, ...msg }))
                .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

            callback(messages);

            // Mark messages as read
            this.markMessagesAsRead(chatId, messages);
        });

        const subId = `messages_${chatId}_${Date.now()}`;
        this.subscriptions.set(subId, unsubscribe);

        return subId;
    }

    // Mark messages as read
    markMessagesAsRead(chatId, messages) {
        if (!this.db || !this.userId) return;

        messages.forEach(message => {
            if (message.senderId !== this.userId && !message.read) {
                const readRef = ref(this.db, `chats/${chatId}/messages/${message.id}/read`);
                set(readRef, true);

                // Also add read receipt
                const receiptRef = ref(this.db, `chats/${chatId}/readReceipts/${message.id}/${this.userId}`);
                set(receiptRef, {
                    readAt: serverTimestamp(),
                    userId: this.userId
                });
            }
        });
    }

    // ============= MARKETPLACE NOTIFICATIONS =============

    // Notify campus about new listing
    notifyNewListing(listing) {
        if (!this.db || !listing.campus) return;

        const notificationRef = ref(this.db, `marketplace/${listing.campus}/newListings/${listing.id}`);

        return set(notificationRef, {
            ...listing,
            notifiedAt: serverTimestamp(),
            notifiedAtISO: new Date().toISOString(),
            type: 'new_listing'
        });
    }

    // Watch for new listings in campus
    watchNewListings(campus, callback) {
        if (!this.db) return null;

        const listingsRef = ref(this.db, `marketplace/${campus}/newListings`);
        const listingsQuery = query(listingsRef, limitToLast(20));

        const unsubscribe = onValue(listingsQuery, (snapshot) => {
            const data = snapshot.val() || {};
            const listings = Object.entries(data)
                .map(([id, listing]) => ({ id, ...listing }))
                .filter(listing => {
                    // Filter out listings older than 24 hours
                    const notifiedAt = listing.notifiedAt;
                    if (notifiedAt && notifiedAt.seconds) {
                        const age = Date.now() - (notifiedAt.seconds * 1000);
                        return age < 24 * 60 * 60 * 1000;
                    }
                    return true;
                })
                .sort((a, b) => (b.notifiedAt || 0) - (a.notifiedAt || 0));

            callback(listings);
        });

        const subId = `listings_${campus}_${Date.now()}`;
        this.subscriptions.set(subId, unsubscribe);

        return subId;
    }

    // ============= NOTIFICATIONS =============

    // Send notification to user
    sendNotification(userId, notification) {
        if (!this.db) return;

        const notificationRef = ref(this.db, `notifications/${userId}/${Date.now()}`);

        return set(notificationRef, {
            ...notification,
            timestamp: serverTimestamp(),
            timestampISO: new Date().toISOString(),
            read: false,
            id: Date.now().toString()
        });
    }

    // Watch user notifications
    watchNotifications(callback) {
        if (!this.db || !this.userId) return null;

        const notificationsRef = ref(this.db, `notifications/${this.userId}`);
        const notificationsQuery = query(notificationsRef, limitToLast(50));

        const unsubscribe = onValue(notificationsQuery, (snapshot) => {
            const data = snapshot.val() || {};
            const notifications = Object.entries(data)
                .map(([id, notif]) => ({ id, ...notif }))
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            callback(notifications);
        });

        const subId = `notifications_${this.userId}_${Date.now()}`;
        this.subscriptions.set(subId, unsubscribe);

        return subId;
    }

    // Mark notification as read
    markNotificationRead(notificationId) {
        if (!this.db || !this.userId) return;

        const notificationRef = ref(this.db, `notifications/${this.userId}/${notificationId}/read`);
        return set(notificationRef, true);
    }

    // ============= UTILITIES =============

    // Unsubscribe from a listener
    unsubscribe(subscriptionId) {
        if (this.subscriptions.has(subscriptionId)) {
            const unsubscribe = this.subscriptions.get(subscriptionId);
            unsubscribe();
            this.subscriptions.delete(subscriptionId);
            console.log(`Unsubscribed: ${subscriptionId}`);
        }
    }

    // Unsubscribe from all listeners
    unsubscribeAll() {
        this.subscriptions.forEach((unsubscribe, id) => {
            unsubscribe();
            console.log(`Unsubscribed: ${id}`);
        });
        this.subscriptions.clear();
    }

    // Clean up all resources
    cleanup() {
        // Clear all typing timeouts
        this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
        this.typingTimeouts.clear();

        // Clear presence interval
        if (this.presenceInterval) {
            clearInterval(this.presenceInterval);
            this.presenceInterval = null;
        }

        // Unsubscribe from all listeners
        this.unsubscribeAll();

        // Set offline status
        if (this.db && this.userId) {
            const statusRef = ref(this.db, `status/${this.userId}`);
            set(statusRef, {
                online: false,
                lastSeen: serverTimestamp(),
                lastSeenISO: new Date().toISOString()
            });

            const userRef = ref(this.db, `users/${this.userId}`);
            update(userRef, {
                online: false,
                lastSeen: serverTimestamp()
            });
        }

        console.log('🧹 Cleaned up all realtime resources');
    }
}

// Create singleton instance
let sparkleRealtime;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.currentUser && window.firebaseConfig) {
        sparkleRealtime = new SparkleRealtime();
        window.sparkleRealtime = sparkleRealtime;
    } else {
        console.warn('⚠️ Missing currentUser or firebaseConfig, SparkleRealtime not initialized');
    }
});

// Export for module usage
export default SparkleRealtime;
// We also export for non-module usage via window
window.SparkleRealtimeClass = SparkleRealtime;
