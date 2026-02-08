// Marketplace WebSocket Client
class MarketplaceSocket {
    constructor() {
        this.socket = null;
        this.userId = null;
        this.campus = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        
        this.messageHandlers = new Map();
        this.chatRooms = new Set();
        
        this.init();
    }
    
    init() {
        // Get user data from page
        this.userId = document.getElementById('userId')?.value || window.userId;
        this.campus = document.getElementById('userCampus')?.value || window.userCampus || 'main_campus';
        
        this.connect();
        this.setupEventListeners();
    }
    
    connect() {
        if (this.socket && this.socket.connected) {
            return;
        }
        
        try {
            // Connect to WebSocket server
            this.socket = io({
                auth: {
                    userId: this.userId,
                    campus: this.campus
                },
                query: {
                    userId: this.userId,
                    campus: this.campus
                },
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: this.reconnectDelay,
                timeout: 10000
            });
            
            this.setupSocketEvents();
            
        } catch (error) {
            console.error('Failed to connect to WebSocket:', error);
            this.scheduleReconnect();
        }
    }
    
    setupSocketEvents() {
        if (!this.socket) return;
        
        // Connection events
        this.socket.on('connect', () => {
            console.log('✅ Connected to Marketplace WebSocket');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.updateConnectionStatus(true);
            
            // Join campus room
            if (this.campus) {
                this.joinCampusRoom(this.campus);
            }
            
            // Restore chat rooms
            this.chatRooms.forEach(chatId => {
                this.joinMarketplaceChat(chatId);
            });
        });
        
        this.socket.on('connected', (data) => {
            console.log('Marketplace WebSocket connection confirmed:', data);
        });
        
        this.socket.on('disconnect', (reason) => {
            console.log('❌ Disconnected from WebSocket:', reason);
            this.isConnected = false;
            this.updateConnectionStatus(false);
            
            if (reason === 'io server disconnect') {
                // Server initiated disconnect, try to reconnect
                this.socket.connect();
            }
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            this.isConnected = false;
            this.updateConnectionStatus(false);
            this.scheduleReconnect();
        });
        
        // Marketplace events
        this.socket.on('new_marketplace_message', this.handleNewMessage.bind(this));
        this.socket.on('marketplace_listing_added', this.handleNewListing.bind(this));
        this.socket.on('listing_sold', this.handleListingSold.bind(this));
        this.socket.on('listing_status_changed', this.handleListingStatusChange.bind(this));
        this.socket.on('user_marketplace_typing', this.handleTypingIndicator.bind(this));
        this.socket.on('marketplace_notification', this.handleNotification.bind(this));
        this.socket.on('chat_message_received', this.handleChatMessage.bind(this));
        this.socket.on('new_listing_available', this.handleNewListingAvailable.bind(this));
        
        // Utility events
        this.socket.on('message_delivered', this.handleMessageDelivered.bind(this));
        this.socket.on('message_error', this.handleMessageError.bind(this));
        this.socket.on('chat_joined', this.handleChatJoined.bind(this));
        this.socket.on('pong', this.handlePong.bind(this));
    }
    
    setupEventListeners() {
        // Reconnect button
        const reconnectBtn = document.getElementById('reconnectSocket');
        if (reconnectBtn) {
            reconnectBtn.addEventListener('click', () => this.reconnect());
        }
        
        // Page visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && !this.isConnected) {
                this.reconnect();
            }
        });
        
        // Before page unload
        window.addEventListener('beforeunload', () => {
            if (this.socket) {
                this.leaveAllChats();
                this.socket.disconnect();
            }
        });
    }
    
    // ========== PUBLIC METHODS ==========
    
    joinMarketplaceChat(chatId) {
        if (!this.isConnected || !chatId) return;
        
        this.socket.emit('join_marketplace_chat', chatId);
        this.chatRooms.add(chatId);
        console.log(`Joined marketplace chat: ${chatId}`);
    }
    
    leaveMarketplaceChat(chatId) {
        if (!this.isConnected || !chatId) return;
        
        this.socket.emit('leave_marketplace_chat', chatId);
        this.chatRooms.delete(chatId);
        console.log(`Left marketplace chat: ${chatId}`);
    }
    
    joinCampusRoom(campus) {
        if (!this.isConnected || !campus) return;
        
        this.campus = campus;
        console.log(`Joined campus room: ${campus}`);
    }
    
    joinListingRoom(listingId) {
        if (!this.isConnected || !listingId) return;
        
        this.socket.emit('join_listing', listingId);
        console.log(`Joined listing room: ${listingId}`);
    }
    
    leaveListingRoom(listingId) {
        if (!this.isConnected || !listingId) return;
        
        this.socket.emit('leave_listing', listingId);
        console.log(`Left listing room: ${listingId}`);
    }
    
    sendMarketplaceMessage(chatId, message, senderId) {
        if (!this.isConnected || !chatId || !message) {
            console.error('Cannot send message: Not connected or missing data');
            return false;
        }
        
        const messageData = {
            chatId,
            message,
            senderId: senderId || this.userId,
            messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString()
        };
        
        this.socket.emit('marketplace_message', messageData);
        return messageData.messageId;
    }
    
    sendTypingIndicator(chatId, isTyping = true) {
        if (!this.isConnected || !chatId) return;
        
        this.socket.emit('marketplace_typing', {
            chatId,
            userId: this.userId,
            isTyping
        });
    }
    
    broadcastNewListing(listing) {
        if (!this.isConnected) return;
        
        this.socket.emit('new_marketplace_listing', {
            ...listing,
            timestamp: new Date()
        });
    }
    
    updateListingStatus(listingId, status, buyerId = null) {
        if (!this.isConnected || !listingId) return;
        
        this.socket.emit('marketplace_listing_updated', {
            listingId,
            status,
            buyerId,
            sellerId: this.userId,
            timestamp: new Date()
        });
    }
    
    sendNotification(userId, notification) {
        if (!this.isConnected || !userId) return;
        
        this.socket.emit('send_notification', {
            userId,
            ...notification,
            timestamp: new Date()
        });
    }
    
    ping() {
        if (!this.isConnected) return;
        
        this.socket.emit('ping', { timestamp: Date.now() });
    }
    
    leaveAllChats() {
        this.chatRooms.forEach(chatId => {
            this.leaveMarketplaceChat(chatId);
        });
        this.chatRooms.clear();
    }
    
    reconnect() {
        console.log('Attempting to reconnect WebSocket...');
        if (this.socket) {
            this.socket.disconnect();
        }
        this.connect();
    }
    
    disconnect() {
        if (this.socket) {
            this.leaveAllChats();
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
            this.updateConnectionStatus(false);
        }
    }
    
    // ========== EVENT HANDLERS ==========
    
    handleNewMessage(data) {
        const { chatId, message, senderId, timestamp } = data;
        
        // Call registered message handlers
        const handlers = this.messageHandlers.get('new_message') || [];
        handlers.forEach(handler => handler(data));
        
        // Update UI if in the chat
        if (this.currentChatId === chatId) {
            this.appendMessageToChat(data);
        }
        
        // Show notification if not in chat
        if (this.currentChatId !== chatId) {
            this.showMessageNotification(data);
        }
    }
    
    handleNewListing(data) {
        console.log('New marketplace listing:', data);
        
        // Update listings UI
        this.updateListingsUI(data);
        
        // Show notification
        this.showNotification({
            title: 'New Listing',
            message: data.message || `New item in ${data.campus}`,
            type: 'info'
        });
    }
    
    handleListingSold(data) {
        console.log('Listing sold:', data);
        
        // Update listing status in UI
        this.updateListingStatusUI(data.listingId, 'sold');
        
        // Show notification to seller
        if (data.buyerId && data.buyerId !== this.userId) {
            this.showNotification({
                title: 'Listing Sold!',
                message: data.message || 'Your item has been sold',
                type: 'success'
            });
        }
    }
    
    handleListingStatusChange(data) {
        console.log('Listing status changed:', data);
        this.updateListingStatusUI(data.listingId, data.status);
    }
    
    handleTypingIndicator(data) {
        const { chatId, userId, isTyping } = data;
        
        if (this.currentChatId === chatId) {
            this.showTypingIndicator(userId, isTyping);
        }
    }
    
    handleNotification(data) {
        console.log('Notification received:', data);
        this.showNotification(data);
    }
    
    handleChatMessage(data) {
        console.log('Chat message received:', data);
        this.handleNewMessage(data);
    }
    
    handleNewListingAvailable(data) {
        console.log('New listing available:', data);
        this.handleNewListing(data);
    }
    
    handleMessageDelivered(data) {
        console.log('Message delivered:', data);
        
        // Update message status in UI
        this.updateMessageStatus(data.messageId, 'delivered');
    }
    
    handleMessageError(data) {
        console.error('Message error:', data);
        
        // Show error to user
        this.showNotification({
            title: 'Message Failed',
            message: data.error || 'Failed to send message',
            type: 'error'
        });
    }
    
    handleChatJoined(data) {
        console.log('Successfully joined chat:', data);
    }
    
    handlePong(data) {
        const latency = Date.now() - data.timestamp;
        console.log(`Pong received. Latency: ${latency}ms`);
    }
    
    // ========== UI UPDATE METHODS ==========
    
    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('socketStatus');
        if (statusEl) {
            statusEl.textContent = connected ? '🟢 Connected' : '🔴 Disconnected';
            statusEl.className = connected ? 'text-success' : 'text-danger';
        }
    }
    
    appendMessageToChat(messageData) {
        // Implement based on your chat UI
        const chatContainer = document.getElementById('chatMessages');
        if (chatContainer) {
            const messageEl = document.createElement('div');
            messageEl.className = `message ${messageData.senderId === this.userId ? 'sent' : 'received'}`;
            messageEl.innerHTML = `
                <div class="message-content">${messageData.message}</div>
                <div class="message-time">${new Date(messageData.timestamp).toLocaleTimeString()}</div>
            `;
            chatContainer.appendChild(messageEl);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }
    
    showMessageNotification(messageData) {
        if (Notification.permission === 'granted') {
            new Notification('New Message', {
                body: messageData.message,
                icon: '/images/notification-icon.png'
            });
        }
        
        // Update badge count
        this.updateUnreadCount();
    }
    
    showNotification(notification) {
        // Use your existing toast system or create a new one
        if (window.showToast) {
            window.showToast(notification.message, notification.type || 'info');
        } else {
            alert(notification.message);
        }
    }
    
    updateListingsUI(listingData) {
        // Refresh listings or append new listing
        if (typeof window.refreshMarketplaceListings === 'function') {
            window.refreshMarketplaceListings();
        }
    }
    
    updateListingStatusUI(listingId, status) {
        // Find listing element and update status
        const listingEl = document.querySelector(`[data-listing-id="${listingId}"]`);
        if (listingEl) {
            const statusEl = listingEl.querySelector('.listing-status');
            if (statusEl) {
                statusEl.textContent = status;
                statusEl.className = `listing-status status-${status}`;
            }
            
            // Disable buy button if sold
            if (status === 'sold') {
                const buyBtn = listingEl.querySelector('.buy-button');
                if (buyBtn) {
                    buyBtn.disabled = true;
                    buyBtn.textContent = 'Sold';
                }
            }
        }
    }
    
    showTypingIndicator(userId, isTyping) {
        const typingEl = document.getElementById('typingIndicator');
        if (typingEl) {
            typingEl.textContent = isTyping ? `${userId} is typing...` : '';
            typingEl.style.display = isTyping ? 'block' : 'none';
        }
    }
    
    updateMessageStatus(messageId, status) {
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
            const statusEl = messageEl.querySelector('.message-status');
            if (statusEl) {
                statusEl.textContent = status;
            }
        }
    }
    
    updateUnreadCount() {
        // Update unread message count badge
        const badge = document.getElementById('unreadMessageCount');
        if (badge) {
            const current = parseInt(badge.textContent) || 0;
            badge.textContent = current + 1;
            badge.style.display = 'inline-block';
        }
    }
    
    // ========== UTILITY METHODS ==========
    
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
        
        console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
            if (!this.isConnected) {
                this.connect();
            }
        }, delay);
    }
    
    // Register custom event handlers
    on(event, handler) {
        if (!this.messageHandlers.has(event)) {
            this.messageHandlers.set(event, []);
        }
        this.messageHandlers.get(event).push(handler);
    }
    
    off(event, handler) {
        if (this.messageHandlers.has(event)) {
            const handlers = this.messageHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
}

// Initialize Marketplace Socket when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.marketplaceSocket = new MarketplaceSocket();
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarketplaceSocket;
}