/**
 * Sparkle Messaging Engine V3
 * Real-time chat experience with Socket.io
 */

class SparkleChat {
    constructor() {
        this.socket = null;
        this.currentChatId = null;
        this.userId = window.sparkleUser?.user_id || window.sparkleUser?.userId;
        this.conversations = [];
        this.typingTimeout = null;
        this.isTyping = false;
        this.isLoading = false;
        
        this.init();
    }

    async init() {
        this.setupSocket();
        this.bindEvents();
        await this.loadInbox();
    }

    setupSocket() {
        // Re-use connection if possible, otherwise init
        this.socket = window.socket || io({
            auth: {
                token: this.getCookie('sparkleToken')
            }
        });

        window.socket = this.socket;

        this.socket.on('connect', () => {
            console.log('🔌 Connected to Sparkle Real-time');
        });

        this.socket.on('new-message', (message) => this.handleIncomingMessage(message));
        this.socket.on('message-sent', (message) => this.handleMessageSent(message));
        this.socket.on('user-typing', (data) => this.handleTypingIndicator(data));
        this.socket.on('messages-read', (data) => this.handleReadReceipt(data));
        this.socket.on('user-status', (data) => this.handleUserStatus(data));
        this.socket.on('new-reaction', (data) => this.handleReaction(data));
        this.socket.on('reaction-removed', (data) => this.handleReactionRemoved(data));
    }

    bindEvents() {
        // Search
        document.getElementById('sidebarSearch')?.addEventListener('input', (e) => this.filterInbox(e.target.value));

        // Message Input
        const textarea = document.getElementById('messageInput');
        textarea?.addEventListener('input', () => {
            this.handleTyping();
            this.autoResizeTextarea(textarea);
        });

        // Media Upload
        const mediaInput = document.getElementById('mediaUpload');
        document.querySelector('.bi-image')?.addEventListener('click', () => mediaInput.click());
        mediaInput?.addEventListener('change', (e) => this.handleMediaUpload(e));

        // Chat Search
        const chatSearchInput = document.getElementById('chatMsgSearch');
        chatSearchInput?.addEventListener('input', (e) => this.handleChatSearch(e.target.value));
        
        // Send Buttons
        document.getElementById('sendBtn')?.addEventListener('click', () => this.sendMessage());
        textarea?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    // --- Inbox & Conversations ---

    async loadInbox() {
        try {
            const response = await fetch('/api/messages/inbox');
            if (response.status === 429) return;
            const result = await response.json();
            if (result.status === 'success') {
                this.conversations = result.data;
                this.renderInbox();
                this.renderActiveFriends();
            }
        } catch (err) {
            console.error('Failed to load inbox:', err);
        }
    }

    renderInbox() {
        const list = document.getElementById('conversationList');
        if (!list) return;

        if (!this.conversations || this.conversations.length === 0) {
            list.innerHTML = `
                <div class="chat-empty-state">
                    <i class="bi bi-chat-dots"></i>
                    <p>Your inbox is empty. Start a conversation with a friend!</p>
                </div>
            `;
            return;
        }

        list.innerHTML = this.conversations.map(conv => {
            const lastMsg = conv.last_message ? (conv.last_message_type === 'text' ? conv.last_message : `Sent a ${conv.last_message_type}`) : 'Start chatting...';
            const isActive = this.currentChatId === conv.chat_id ? 'active' : '';
            const unreadClass = conv.unread_count > 0 ? 'unread' : '';
            
            return `
                <div class="conversation-card ${isActive}" onclick="sparkChat.openChat('${conv.chat_id}')" data-id="${conv.chat_id}">
                    <div class="conv-avatar-wrapper">
                        <img src="${conv.partner_avatar || '/uploads/avatars/default.png'}" alt="">
                        ${conv.is_online ? '<div class="af-online-dot"></div>' : ''}
                    </div>
                    <div class="conv-info">
                        <div class="conv-header">
                            <span class="conv-name">${conv.partner_name}</span>
                            <span class="conv-time">${this.formatTime(conv.last_message_at)}</span>
                        </div>
                        <div class="conv-preview">
                            <span class="last-msg-text ${unreadClass}">${lastMsg}</span>
                            ${conv.unread_count > 0 ? `<span class="conv-unread-badge">${conv.unread_count}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderActiveFriends() {
        const carousel = document.getElementById('activeFriendsCarousel');
        if (!carousel) return;

        const onlineUsers = this.conversations.filter(c => c.is_online && c.chat_type === 'personal');
        if (onlineUsers.length === 0) {
            carousel.parentElement.style.display = 'none';
            return;
        }

        carousel.parentElement.style.display = 'block';
        carousel.innerHTML = onlineUsers.map(user => `
            <div class="active-friend-item" onclick="sparkChat.openChat('${user.chat_id}')">
                <div class="af-avatar-wrapper">
                    <img src="${user.partner_avatar || '/uploads/avatars/default.png'}" alt="">
                    <div class="af-online-dot"></div>
                </div>
                <div class="af-name">${user.partner_name.split(' ')[0]}</div>
            </div>
        `).join('');
    }

    filterInbox(query) {
        const cards = document.querySelectorAll('.conversation-card');
        cards.forEach(card => {
            const name = card.querySelector('.conv-name').textContent.toLowerCase();
            const msg = card.querySelector('.last-msg-text').textContent.toLowerCase();
            card.style.display = (name.includes(query.toLowerCase()) || msg.includes(query.toLowerCase())) ? 'flex' : 'none';
        });
    }

    // --- Chat Logic ---

    async openChat(chatId) {
        if (this.currentChatId === chatId) return;
        
        this.currentChatId = chatId;
        document.querySelector('.messaging-layout').classList.add('chat-active');
        
        // Update UI state
        document.querySelectorAll('.conversation-card').forEach(c => c.classList.remove('active'));
        document.querySelector(`.conversation-card[data-id="${chatId}"]`)?.classList.add('active');

        // Load messages
        await this.loadMessages(chatId);
        
        // Join socket room
        this.socket.emit('join-chat', chatId);
        
        // Mark as read in UI and Server
        this.socket.emit('mark-read', chatId);
        
        // Refresh inbox unread counts
        const conv = this.conversations.find(c => c.chat_id === chatId);
        if (conv) conv.unread_count = 0;
        this.renderInbox();
    }

    async loadMessages(chatId) {
        if (this.isLoading || !chatId) return;
        this.isLoading = true;

        const container = document.getElementById('messagesContainer');
        const emptyState = document.getElementById('chatEmptyWindow');
        const chatMain = document.getElementById('chatMain');
        
        if (emptyState) emptyState.style.display = 'none';
        if (chatMain) chatMain.style.display = 'flex';

        container.innerHTML = `
            <div class="chat-loader" style="display: flex; justify-content: center; padding: 20px;">
                <div class="spinner-pink"></div>
            </div>
        `;

        try {
            const response = await fetch(`/api/messages/chat/${chatId}`);
            
            if (response.status === 429) {
                container.innerHTML = '<div class="error-msg">Too many requests. Please wait a moment...</div>';
                return;
            }

            const result = await response.json();
            
            if (result.status === 'success') {
                this.renderMessages(result.data);
                this.updateChatHeader(chatId);
            }
        } catch (err) {
            console.error('Load messages error:', err);
            container.innerHTML = '<div class="error-msg">Failed to load messages.</div>';
        } finally {
            this.isLoading = false;
        }
    }

    renderMessages(messages) {
        const container = document.getElementById('messagesContainer');
        if (!container) return;

        if (!messages || messages.length === 0) {
            container.innerHTML = '<div class="date-divider">Start of your conversation</div>';
            return;
        }

        let html = '';
        let lastDate = null;

        messages.forEach(msg => {
            const msgDate = new Date(msg.sent_at).toDateString();
            if (msgDate !== lastDate) {
                html += `<div class="date-divider">${this.formatFullDate(msg.sent_at)}</div>`;
                lastDate = msgDate;
            }
            html += this.createMessageHTML(msg);
        });

        container.innerHTML = html;
        this.scrollToBottom();
    }

    createMessageHTML(msg) {
        const isMe = msg.sender_id === this.userId;
        let statusIcon = 'bi-check2';
        if (msg.status === 'delivered') statusIcon = 'bi-check2-all';
        if (msg.status === 'read') statusIcon = 'bi-check2-all';
        
        const readClass = msg.status === 'read' ? 'read' : '';
        
        let mediaContent = '';
        if (msg.media_url) {
            if (msg.type === 'image' || msg.media_url.match(/\.(jpeg|jpg|gif|png)$/i)) {
                mediaContent = `<img src="${msg.media_url}" class="msg-media-img" onclick="window.open('${msg.media_url}')">`;
            } else if (msg.type === 'video' || msg.media_url.match(/\.(mp4|webm)$/i)) {
                mediaContent = `<video src="${msg.media_url}" controls class="msg-media-video"></video>`;
            }
        }

        return `
            <div class="msg-bubble ${isMe ? 'msg-sent' : 'msg-received'}" data-msg-id="${msg.message_id}">
                ${msg.reply_to_message_id ? `
                    <div class="reply-preview">
                        <i class="bi bi-reply-fill"></i>
                        <span>${msg.reply_content}</span>
                    </div>
                ` : ''}
                ${mediaContent}
                ${msg.content ? `<div class="msg-body">${msg.content}</div>` : ''}
                <div class="msg-footer">
                    <span>${this.formatTime(msg.sent_at)}</span>
                    ${isMe ? `<span class="msg-tick ${readClass}"><i class="bi ${statusIcon}"></i></span>` : ''}
                </div>
            </div>
        `;
    }

    updateChatHeader(chatId) {
        const conv = this.conversations.find(c => c.chat_id === chatId);
        if (!conv) return;

        document.getElementById('bannerAvatar').src = conv.partner_avatar || '/uploads/avatars/default.png';
        document.getElementById('bannerName').textContent = conv.partner_name;
        
        const statusEl = document.getElementById('bannerStatus');
        if (conv.chat_type === 'group') {
             statusEl.textContent = (conv.member_count || 'Several') + ' members';
             statusEl.classList.remove('offline');
        } else if (conv.is_online) {
            statusEl.textContent = 'Active Now';
            statusEl.classList.remove('offline');
        } else {
            statusEl.textContent = conv.last_seen_at ? 'Last seen ' + this.formatTime(conv.last_seen_at) : 'Offline';
            statusEl.classList.add('offline');
        }

        // Hide search on chat switch without triggering a reload loop
        this.toggleChatSearch(false, true);
    }

    toggleChatSearch(show, skipReload = false) {
        const wrap = document.getElementById('headerSearchWrap');
        if (!wrap) return;
        wrap.style.display = show ? 'flex' : 'none';
        if (show) document.getElementById('chatMsgSearch').focus();
        else {
            document.getElementById('chatMsgSearch').value = '';
            if (!skipReload) this.handleChatSearch(''); 
        }
    }

    async handleChatSearch(query) {
        if (!query || query.length < 2) {
            // Restore from current chat messages (re-render)
            // For now, just reload the chat to be safe, or we could cache
            if (query === '') await this.loadMessages(this.currentChatId);
            return;
        }

        try {
            const response = await fetch(`/api/messages/search?chatId=${this.currentChatId}&q=${query}`);
            
            if (response.status === 429) {
                console.warn('Search rate limited');
                return;
            }

            const result = await response.json();
            if (result.status === 'success') {
                this.renderMessages(result.data);
                // Highlight matches? Maybe later
            }
        } catch (err) {
            console.error('Search error:', err);
        }
    }

    // --- Message Sending ---

    async handleMediaUpload(event) {
        const file = event.target.files[0];
        if (!file || !this.currentChatId) return;

        const formData = new FormData();
        formData.append('media', file);

        try {
            // Show temporary loading bubble
            const container = document.getElementById('messagesContainer');
            const placeholderId = 'uploading-' + Date.now();
            container.insertAdjacentHTML('beforeend', `
                <div class="msg-bubble msg-sent" id="${placeholderId}">
                    <div class="chat-loader"><div class="spinner-pink" style="width:20px; height:20px;"></div></div>
                    <div class="msg-body">Uploading media...</div>
                </div>
            `);
            this.scrollToBottom();

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            
            document.getElementById(placeholderId)?.remove();

            if (result.success) {
                const conv = this.conversations.find(c => c.chat_id === this.currentChatId);
                const type = file.type.startsWith('image') ? 'image' : 'video';
                
                this.socket.emit('send-message', {
                    chatId: this.currentChatId,
                    recipientId: conv?.partner_id,
                    content: '',
                    type: type,
                    mediaUrl: result.data.url
                });
            } else {
                alert('Upload failed: ' + result.error);
            }
        } catch (err) {
            console.error('Media upload error:', err);
            alert('Media upload failed');
        }
    }

    sendMessage() {
        const input = document.getElementById('messageInput');
        const content = input.value.trim();
        if (!content || !this.currentChatId) return;

        const conv = this.conversations.find(c => c.chat_id === this.currentChatId);
        const data = {
            chatId: this.currentChatId,
            recipientId: conv?.partner_id,
            content: content,
            type: 'text'
        };

        this.socket.emit('send-message', data);
        input.value = '';
        input.style.height = 'auto';
        this.stopTyping();
    }

    handleIncomingMessage(msg) {
        const msgChatId = msg.conversation_id || msg.chat_id;
        if (this.currentChatId === msgChatId) {
            const container = document.getElementById('messagesContainer');
            container.insertAdjacentHTML('beforeend', this.createMessageHTML(msg));
            this.scrollToBottom();
            this.socket.emit('mark-read', this.currentChatId);
        } else {
            this.loadInbox();
        }
    }

    handleMessageSent(msg) {
        const container = document.getElementById('messagesContainer');
        container.insertAdjacentHTML('beforeend', this.createMessageHTML(msg));
        this.scrollToBottom();
        this.loadInbox();
    }

    // --- Presence & Status ---

    handleUserStatus(data) {
        const { userId, isOnline, lastSeen } = data;
        const conv = this.conversations.find(c => c.partner_id === userId);
        if (conv) {
            conv.is_online = isOnline;
            conv.last_seen_at = lastSeen;
            this.renderInbox();
            this.renderActiveFriends();
            if (this.currentChatId === conv.chat_id) {
                this.updateChatHeader(conv.chat_id);
            }
        }
    }

    handleReadReceipt(data) {
        const { chatId } = data;
        if (this.currentChatId === chatId) {
            document.querySelectorAll('.msg-sent .msg-tick').forEach(tick => {
                tick.classList.add('read');
                tick.querySelector('i').className = 'bi bi-check2-all';
            });
        }
    }

    // --- Typing Indicators ---

    handleTyping() {
        if (!this.isTyping) {
            this.isTyping = true;
            this.socket.emit('typing', { chatId: this.currentChatId, isTyping: true });
        }

        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => this.stopTyping(), 2500);
    }

    stopTyping() {
        this.isTyping = false;
        this.socket.emit('typing', { chatId: this.currentChatId, isTyping: false });
    }

    handleTypingIndicator(data) {
        const { chatId, isTyping, username } = data;
        if (this.currentChatId !== chatId) return;

        let pill = document.getElementById('typingIndicator');
        if (isTyping) {
            if (!pill) {
                const container = document.getElementById('messagesContainer');
                container.insertAdjacentHTML('beforeend', `
                    <div id="typingIndicator" class="typing-pill">
                        <div class="typing-dots"><span></span><span></span><span></span></div>
                        <span>${username} is typing...</span>
                    </div>
                `);
                this.scrollToBottom();
            }
        } else {
            pill?.remove();
        }
    }

    // --- Utils ---

    scrollToBottom() {
        const container = document.getElementById('messagesContainer');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = (now - date) / 1000;

        if (diff < 60) return 'Just now';
        
        // Same day
        if (date.toDateString() === now.toDateString()) {
             return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        }
        
        // Same week
        if (diff < 86400 * 7) {
            return date.toLocaleDateString([], { weekday: 'short' });
        }

        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    formatFullDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        if (date.toDateString() === now.toDateString()) return 'Today';
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        
        return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    }

    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }
}

// Mobile support helper
function closeChat() {
    document.querySelector('.messaging-layout').classList.remove('chat-active');
    if (window.sparkChat) window.sparkChat.currentChatId = null;
}

// Global instance
window.addEventListener('DOMContentLoaded', () => {
    window.sparkChat = new SparkleChat();
});
