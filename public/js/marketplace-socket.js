/**
 * Marketplace Firebase Realtime Client
 * Migrated from Socket.io for Vercel Serverless compatibility
 */
class MarketplaceSocket {
    constructor() {
        this.userId = null;
        this.campus = null;
        this.isConnected = false;
        this.messageHandlers = new Map();
        this.chatRooms = new Set();
        this.subscriptions = new Map();
        this.retryCount = 0;
        this.MAX_RETRIES = 20; // Max 10 seconds (20 * 500ms)

        this.init();
    }

    init() {
        // Get user data from page
        this.userId = window.currentUserId || document.getElementById('userId')?.value || window.userId;
        this.campus = window.currentUser?.campus || document.getElementById('userCampus')?.value || window.userCampus || 'main_campus';

        // Wait for Firebase to be ready
        this.waitForRealtime();
        this.setupEventListeners();
    }

    waitForRealtime() {
        if (window.sparkleRealtime) {
            this.realtime = window.sparkleRealtime;
            this.handleConnect();
        } else {
            this.retryCount++;

            if (this.retryCount >= this.MAX_RETRIES) {
                console.error('❌ SparkleRealtime not available after maximum retries. Firebase may not be configured.');
                return;
            }

            console.log(`⏳ Waiting for SparkleRealtime... (${this.retryCount}/${this.MAX_RETRIES})`);
            setTimeout(() => this.waitForRealtime(), 500);
        }
    }

    handleConnect() {
        console.log('✅ Marketplace connected to Firebase Realtime');
        this.isConnected = true;
        this.updateConnectionStatus(true);

        // Watch for new listings in campus
        if (this.campus) {
            this.joinCampusRoom(this.campus);
        }

        // Restore chat rooms
        this.chatRooms.forEach(chatId => {
            this.joinMarketplaceChat(chatId);
        });
    }

    setupEventListeners() {
        // Page visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && !this.isConnected) {
                // Presence is handled automatically by SparkleRealtime class
            }
        });

        // Before page unload
        window.addEventListener('beforeunload', () => {
            this.disconnect();
        });
    }

    // ========== PUBLIC METHODS (API COMPATIBILITY) ==========

    joinMarketplaceChat(chatId) {
        if (!chatId) return;

        this.chatRooms.add(chatId);

        // Subscribe to messages
        const subId = this.realtime.watchMessages(chatId, (messages) => {
            // New message handled by handleChatMessage (which routes to handleNewMessage)
            // But watchMessages returns the whole list, so we handle it differently
            if (messages.length > 0) {
                const latest = messages[messages.length - 1];
                // Only trigger if it's not from us or if it's brand new
                this.handleChatMessage({
                    chatId,
                    message: latest.text,
                    senderId: latest.senderId,
                    timestamp: latest.timestamp,
                    messageId: latest.id
                });
            }
        });

        // Subscribe to typing
        const typingSubId = this.realtime.watchTyping(chatId, (users) => {
            if (users.length > 0) {
                this.handleTypingIndicator({
                    chatId,
                    userId: users[0].userId,
                    isTyping: true
                });
            } else {
                this.handleTypingIndicator({
                    chatId,
                    isTyping: false
                });
            }
        });

        this.subscriptions.set(`chat_${chatId}`, subId);
        this.subscriptions.set(`typing_${chatId}`, typingSubId);

        console.log(`📡 watching marketplace chat: ${chatId}`);
    }

    leaveMarketplaceChat(chatId) {
        if (!chatId) return;

        this.chatRooms.delete(chatId);
        this.realtime.unsubscribe(this.subscriptions.get(`chat_${chatId}`));
        this.realtime.unsubscribe(this.subscriptions.get(`typing_${chatId}`));
        this.subscriptions.delete(`chat_${chatId}`);
        this.subscriptions.delete(`typing_${chatId}`);

        console.log(`Left marketplace chat: ${chatId}`);
    }

    joinCampusRoom(campus) {
        this.campus = campus;

        // Subscribe to new listings for this campus
        const subId = this.realtime.watchNewListings(campus, (listings) => {
            if (listings.length > 0) {
                const newest = listings[0];
                this.handleNewListing(newest);
            }
        });

        this.subscriptions.set(`campus_${campus}`, subId);
        console.log(`Joined campus room: ${campus}`);
    }

    sendMarketplaceMessage(chatId, message, senderId) {
        if (!chatId || !message) return false;

        return this.realtime.sendMessage(chatId, message);
    }

    sendTypingIndicator(chatId, isTyping = true) {
        if (!chatId) return;

        if (isTyping) {
            this.realtime.startTyping(chatId);
        } else {
            this.realtime.stopTyping(chatId);
        }
    }

    broadcastNewListing(listing) {
        if (!listing) return;
        return this.realtime.notifyNewListing(listing);
    }

    updateListingStatus(listingId, status, buyerId = null) {
        // Logic for Firebase-only updates could go here, 
        // but typically this also hits the SQL DB via API
        console.log(`Status update for ${listingId}: ${status}`);
    }

    sendNotification(userId, notification) {
        return this.realtime.sendNotification(userId, notification);
    }

    disconnect() {
        this.subscriptions.forEach((subId) => this.realtime.unsubscribe(subId));
        this.subscriptions.clear();
        this.isConnected = false;
        this.updateConnectionStatus(false);
    }

    reconnect() {
        this.handleConnect();
    }

    // ========== EVENT HANDLERS ==========

    handleNewMessage(data) {
        // Call registered message handlers
        const handlers = this.messageHandlers.get('new_message') || [];
        handlers.forEach(handler => handler(data));

        // Update UI if in the chat
        if (this.currentChatId === data.chatId) {
            this.appendMessageToChat(data);
        }
    }

    handleNewListing(data) {
        // Update listings UI
        this.updateListingsUI(data);

        // Show info toast
        this.showNotification({
            message: data.title ? `New: ${data.title}` : 'New item available!',
            type: 'info'
        });
    }

    handleTypingIndicator(data) {
        if (this.currentChatId === data.chatId || !data.chatId) {
            this.showTypingIndicator(data.userId || 'Someone', data.isTyping);
        }
    }

    handleChatMessage(data) {
        this.handleNewMessage(data);
    }

    // ========== UI UPDATE METHODS ==========

    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('socketStatus');
        if (statusEl) {
            statusEl.textContent = connected ? '🟢 Live' : '🔴 Offline';
            statusEl.className = connected ? 'text-success' : 'text-danger';
        }
    }

    appendMessageToChat(messageData) {
        const chatContainer = document.getElementById('chatMessages');
        if (chatContainer) {
            // Check if message already exists (Firebase might send duplicate on sub)
            if (document.querySelector(`[data-message-id="${messageData.messageId}"]`)) return;

            const messageEl = document.createElement('div');
            messageEl.className = `message ${messageData.senderId === this.userId ? 'sent' : 'received'}`;
            messageEl.setAttribute('data-message-id', messageData.messageId);
            messageEl.innerHTML = `
                <div class="message-content">${this.escapeHtml(messageData.message)}</div>
                <div class="message-time">${new Date(messageData.timestamp).toLocaleTimeString()}</div>
            `;
            chatContainer.appendChild(messageEl);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }

    showNotification(notification) {
        if (window.showToast) {
            window.showToast(notification.message, notification.type || 'info');
        }
    }

    updateListingsUI(listingData) {
        if (typeof window.refreshMarketplaceListings === 'function') {
            window.refreshMarketplaceListings();
        }
    }

    showTypingIndicator(userId, isTyping) {
        const typingEl = document.getElementById('typingIndicator');
        if (typingEl) {
            typingEl.textContent = isTyping ? `${userId} is typing...` : '';
            typingEl.style.display = isTyping ? 'block' : 'none';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Register custom event handlers
    on(event, handler) {
        if (!this.messageHandlers.has(event)) {
            this.messageHandlers.set(event, []);
        }
        this.messageHandlers.get(event).push(handler);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.marketplaceSocket = new MarketplaceSocket();
});
