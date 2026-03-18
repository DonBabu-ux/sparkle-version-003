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
        
        // New State for V3 Features
        this.activeMessageId = null;
        this.replyingToMessageId = null;
        this.editingMessageId = null;
        this.touchStartX = 0;
        this.longPressTimer = null;
        this.selectedGroupUsers = [];
        this.newChatTab = 'new';
        
        this.init();
    }

    async init() {
        this.setupSocket();
        this.bindEvents();
        await this.loadInbox();
        this.checkUrlParameters();
    }

    async checkUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const chatId = urlParams.get('chat');
        const userId = urlParams.get('user');

        if (chatId) {
            console.log('🔗 Deep-link: Opening chat ID', chatId);
            this.openChat(chatId);
        } else if (userId) {
            console.log('🔗 Deep-link: Initializing chat with user', userId);
            try {
                // Try to get existing chat first by just calling openChat with userId
                // The backend model fix now handles userId as input to getMessages
                const response = await fetch(`/api/messages/chat/${userId}`);
                const result = await response.json();
                if (result.status === 'success' && result.chatId) {
                    this.openChat(result.chatId);
                }
            } catch (err) {
                console.error('Deep-link failed:', err);
            }
        }
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
        this.socket.on('message-deleted-everyone', (data) => this.handleMessageDeleted(data));
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
        const sendBtn = document.getElementById('sendBtn');
        sendBtn?.addEventListener('click', () => this.submitMessageForm());
        textarea?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.submitMessageForm();
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.chat-menu-wrapper')) {
                const menu = document.getElementById('chatDropdownMenu');
                if (menu) menu.style.display = 'none';
            }
        });
    }

    submitMessageForm() {
        if (this.editingMessageId) {
            this.sendEdit();
        } else {
            this.sendMessage();
        }
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) {
            if (textarea.value.trim().length > 0 || this.editingMessageId) {
                sendBtn.disabled = false;
            } else {
                sendBtn.disabled = true;
            }
        }
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

    async renderActiveFriends() {
        const carousel = document.getElementById('activeFriendsCarousel');
        if (!carousel) return;

        try {
            const response = await fetch('/api/users/active-friends');
            if (!response.ok) throw new Error('API Error');
            const friends = await response.json();

            if (!friends || friends.length === 0) {
                carousel.parentElement.style.display = 'none';
                return;
            }

            carousel.parentElement.style.display = 'block';
            carousel.innerHTML = friends.map(friend => `
                <div class="active-friend-item" onclick="window.location.href='/profile/${friend.id}'">
                    <div class="af-avatar-wrapper">
                        <img src="${friend.avatar_url || '/uploads/avatars/default.png'}" alt="${friend.username}" onerror="this.src='/uploads/avatars/default.png'">
                        <div class="af-online-dot"></div>
                    </div>
                    <div class="af-name">${friend.username.split(' ')[0]}</div>
                </div>
            `).join('');
        } catch (err) {
            console.error('Failed to load active friends:', err);
            carousel.parentElement.style.display = 'none';
        }
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
        this.bindGestures();
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

        let reactionsHtml = '';
        if (msg.reactions && msg.reactions.length > 0) {
            // Deduplicate emojis and count
            const reactionCounts = {};
            let reactionsArray = msg.reactions;
            if (typeof reactionsArray === 'string') {
                try { reactionsArray = JSON.parse(reactionsArray); } catch(e){}
            }
            if (Array.isArray(reactionsArray)) {
                reactionsArray.forEach(r => {
                    if (r && r.emoji) {
                        reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
                    }
                });
                const summary = Object.entries(reactionCounts).map(([emoji, count]) => `${emoji} ${count > 1 ? count : ''}`).join(' ');
                if (summary) {
                    reactionsHtml = `<div class="msg-reactions"><span class="reaction-badge">${summary}</span></div>`;
                }
            }
        }

        const isDeleted = msg.is_deleted_for_everyone === 1;

        return `
            <div class="msg-bubble ${isMe ? 'msg-sent' : 'msg-received'} ${isDeleted ? 'msg-deleted' : ''}" data-msg-id="${msg.message_id}" data-is-own="${isMe}">
                ${msg.reply_to_message_id && !isDeleted ? `
                    <div class="reply-preview">
                        <i class="bi bi-reply-fill"></i>
                        <span>${msg.reply_content}</span>
                    </div>
                ` : ''}
                ${!isDeleted ? mediaContent : ''}
                ${msg.content || isDeleted ? `<div class="msg-body">${isDeleted ? '🚫 This message was deleted.' : msg.content}</div>` : ''}
                <div class="msg-footer">
                    <span>${this.formatTime(msg.sent_at)}</span>
                    ${msg.edited_at && !isDeleted ? '<span style="font-style:italic; margin-inline: 4px;">(edited)</span>' : ''}
                    ${isMe && !isDeleted ? `<span class="msg-tick ${readClass}"><i class="bi ${statusIcon}"></i></span>` : ''}
                </div>
                ${reactionsHtml}
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

        // Use '==' to handle cases where one is string and one is int
        const conv = this.conversations.find(c => c.chat_id == this.currentChatId);
        const data = {
            chatId: this.currentChatId,
            recipientId: conv?.partner_id,
            content: content,
            type: 'text',
            replyToId: this.replyingToMessageId
        };

        this.socket.emit('send-message', data);
        input.value = '';
        input.style.height = 'auto';
        document.getElementById('sendBtn').disabled = true;
        this.stopTyping();
        this.cancelReplyOrEdit();
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

    // ==========================================
    // V3 EXTENDED FEATURES 
    // ==========================================

    bindGestures() {
        const bubbles = document.querySelectorAll('.msg-bubble');
        bubbles.forEach(bubble => {
            // Only attach if not deleted
            if (bubble.classList.contains('msg-deleted')) return;

            bubble.addEventListener('touchstart', (e) => {
                this.touchStartX = e.changedTouches[0].screenX;
                this.longPressTimer = setTimeout(() => {
                    this.openMessageActionMenu(bubble.dataset.msgId, bubble.dataset.isOwn === 'true');
                }, 500);
            }, { passive: true });

            bubble.addEventListener('touchend', (e) => {
                clearTimeout(this.longPressTimer);
                const touchEndX = e.changedTouches[0].screenX;
                const diffX = this.touchStartX - touchEndX;

                if (Math.abs(diffX) > 50) {
                    // Swipe right or left triggers reply directly
                    this.activeMessageId = bubble.dataset.msgId;
                    this.handleActionReply();
                }
            }, { passive: true });

            // Desktop fallback: right click for actions
            bubble.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.openMessageActionMenu(bubble.dataset.msgId, bubble.dataset.isOwn === 'true');
            });
            // Desktop fallback: double click for heart
            bubble.addEventListener('dblclick', () => {
                this.activeMessageId = bubble.dataset.msgId;
                this.selectReaction('❤️');
            });
        });
    }

    // --- Unified Action Drawer ---
    openMessageActionMenu(msgId, isOwn) {
        this.activeMessageId = msgId;
        const msgEl = document.querySelector(`.msg-bubble[data-msg-id="${msgId}"]`);
        if (!msgEl) return;

        document.getElementById('actionDrawerEditBtn').style.display = isOwn ? 'flex' : 'none';
        document.getElementById('actionDrawerDeleteEveryoneBtn').style.display = isOwn ? 'flex' : 'none';

        document.getElementById('messageActionOverlay').style.display = 'flex';
    }

    closeMessageActionMenu() {
        document.getElementById('messageActionOverlay').style.display = 'none';
        this.activeMessageId = null;
    }

    handleActionReply() {
        this.replyingToMessageId = this.activeMessageId;
        const msgEl = document.querySelector(`.msg-bubble[data-msg-id="${this.activeMessageId}"]`);
        
        document.getElementById('previewLabel').textContent = 'Replying to';
        document.getElementById('previewText').textContent = msgEl.querySelector('.msg-body')?.textContent || 'Message';
        document.getElementById('messagePreviewContainer').style.display = 'flex';
        
        document.getElementById('messageInput').focus();
        this.closeMessageActionMenu();
    }

    handleActionEdit() {
        this.editingMessageId = this.activeMessageId;
        const msgEl = document.querySelector(`.msg-bubble[data-msg-id="${this.activeMessageId}"]`);
        
        document.getElementById('previewLabel').textContent = 'Editing Message';
        document.getElementById('previewText').textContent = msgEl.querySelector('.msg-body')?.textContent || '';
        document.getElementById('messagePreviewContainer').style.display = 'flex';
        
        const input = document.getElementById('messageInput');
        input.value = msgEl.querySelector('.msg-body')?.textContent || '';
        input.focus();
        this.autoResizeTextarea(input);
        
        this.closeMessageActionMenu();
    }

    async sendEdit() {
        if (!this.editingMessageId) return;
        const input = document.getElementById('messageInput');
        const content = input.value.trim();
        
        try {
            const response = await fetch(`/api/messages/${this.editingMessageId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });
            const result = await response.json();
            if (result.status === 'success') {
                // Update local UI
                const msgEl = document.querySelector(`.msg-bubble[data-msg-id="${this.editingMessageId}"]`);
                if (msgEl) {
                    const body = msgEl.querySelector('.msg-body');
                    if (body) body.textContent = content;
                }
            } else {
                alert(result.error || 'Cannot edit this message anymore.');
            }
        } catch (err) {
            console.error(err);
        }
        
        this.cancelReplyOrEdit();
    }

    async handleActionDeleteForMe() {
        if (!this.activeMessageId) return;
        try {
            await fetch(`/api/messages/${this.activeMessageId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ forEveryone: false })
            });
            const msgEl = document.querySelector(`.msg-bubble[data-msg-id="${this.activeMessageId}"]`);
            if (msgEl) msgEl.remove();
        } catch (err) {}
        this.closeMessageActionMenu();
    }

    async handleActionDeleteForEveryone() {
        if (!this.activeMessageId) return;
        try {
            await fetch(`/api/messages/${this.activeMessageId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ forEveryone: true })
            });
            this.socket.emit('delete-for-everyone', { 
                messageId: this.activeMessageId, 
                chatId: this.currentChatId 
            });
            
            // Delete locally
            this.handleMessageDeleted({ messageId: this.activeMessageId });
        } catch (err) {}
        this.closeMessageActionMenu();
    }

    handleMessageDeleted(data) {
        if (data.messageId) {
            const msgEl = document.querySelector(`.msg-bubble[data-msg-id="${data.messageId}"]`);
            if (msgEl) {
                msgEl.classList.add('msg-deleted');
                const body = msgEl.querySelector('.msg-body');
                if (body) body.textContent = '🚫 This message was deleted.';
                const media = msgEl.querySelector('.msg-media-img, .msg-media-video');
                if (media) media.remove();
                const reply = msgEl.querySelector('.reply-preview');
                if (reply) reply.remove();
            }
        }
    }

    cancelReplyOrEdit() {
        this.replyingToMessageId = null;
        this.editingMessageId = null;
        document.getElementById('messagePreviewContainer').style.display = 'none';
        const input = document.getElementById('messageInput');
        input.value = '';
        this.autoResizeTextarea(input);
    }

    // --- Reactions ---

    selectReaction(emoji) {
        if (!this.activeMessageId || !this.currentChatId) return;
        this.socket.emit('add-reaction', {
            messageId: this.activeMessageId,
            chatId: this.currentChatId,
            emoji
        });
        this.closeMessageActionMenu();
    }

    handleReaction(data) {
        // We need to refresh the messages or mutate the DOM
        // The easiest is just to reload or inject it manually
        // For now, let's just trigger a chat reload if we are in this chat, to get accurate groupings
        if (this.currentChatId === data.chatId) {
            // Only if it's not our own emit looping back, but we can debounce it or just inject
            this.loadMessages(this.currentChatId); // In a real app we'd mutate DOM directly to avoid load jitter
        }
    }
    
    handleReactionRemoved(data) {
        if (this.currentChatId === data.chatId) {
            this.loadMessages(this.currentChatId);
        }
    }

    // --- Header Dropdown ---
    toggleChatMenu() {
        const menu = document.getElementById('chatDropdownMenu');
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        
        const conv = this.conversations.find(c => c.chat_id === this.currentChatId);
        if (conv) {
            document.getElementById('menuGroupSettings').style.display = conv.chat_type === 'group' ? 'block' : 'none';
        }
    }

    async handleMuteNotifications() {
        if (!this.currentChatId) return;
        await fetch(`/api/messages/mute/${this.currentChatId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ muted: true })
        });
        alert('Chat muted!');
        document.getElementById('chatDropdownMenu').style.display = 'none';
    }

    // --- New Chat Modal ---
    openNewChatModal() {
        document.getElementById('newChatModalOverlay').style.display = 'flex';
        this.switchNewChatTab('new');
        this.selectedGroupUsers = [];
        this.renderSelectedGroupUsers();
        this.loadFollowedUsers();
    }

    async loadFollowedUsers() {
        const resultsEl = document.getElementById('userSearchResults');
        resultsEl.innerHTML = '<div class="text-center text-gray-500 py-4 text-sm"><div class="spinner-pink mx-auto"></div></div>';
        try {
            const res = await fetch('/api/users/following');
            const result = await res.json();
            const users = result.data || result.users || (Array.isArray(result) ? result : []);
            this._followedUsers = users;
            if (users.length === 0) {
                resultsEl.innerHTML = '<div class="text-center text-gray-500 py-4 text-sm">You\'re not following anyone yet.</div>';
                return;
            }
            this.renderUserList(users, resultsEl);
        } catch (e) {
            resultsEl.innerHTML = '<div class="text-center text-gray-500 py-4 text-sm">Could not load contacts.</div>';
        }
    }

    renderUserList(users, container) {
        container.innerHTML = users.map(user => `
            <div class="user-search-result" onclick="sparkChat.selectUserFromSearch('${user.user_id}', '${user.name}', '${user.avatar_url}')">
                <div style="position:relative;flex-shrink:0;">
                    <img src="${user.avatar_url || '/uploads/avatars/default.png'}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;">
                    ${user.is_online ? '<div style="position:absolute;bottom:1px;right:1px;width:12px;height:12px;background:#22c55e;border-radius:50%;border:2px solid white;"></div>' : ''}
                </div>
                <div class="flex-1" style="min-width:0;">
                    <div style="font-weight:600;font-size:14px;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${user.name}</div>
                    <div style="font-size:12px;color:#888;">@${user.username}</div>
                </div>
                ${this.newChatTab === 'group' ? `
                    <div style="width:22px;height:22px;border-radius:50%;border:2px solid ${this.selectedGroupUsers.find(u => u.id === user.user_id) ? '#3b82f6' : '#d1d5db'};background:${this.selectedGroupUsers.find(u => u.id === user.user_id) ? '#3b82f6' : 'white'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        ${this.selectedGroupUsers.find(u => u.id === user.user_id) ? '<i class="bi bi-check" style="color:white;font-size:13px;"></i>' : ''}
                    </div>
                ` : '<i class="bi bi-chevron-right" style="color:#d1d5db;font-size:14px;"></i>'}
            </div>
        `).join('');
    }
    
    closeNewChatModal(force = false) {
        if (force || event.target.id === 'newChatModalOverlay') {
            document.getElementById('newChatModalOverlay').style.display = 'none';
        }
    }

    switchNewChatTab(tab) {
        this.newChatTab = tab;

        // Pill-style tab toggle
        const tabNew = document.getElementById('tabNewMessage');
        const tabGroup = document.getElementById('tabCreateGroup');
        tabNew.style.background = tab === 'new' ? 'white' : 'transparent';
        tabNew.style.color = tab === 'new' ? '#6366f1' : '#94a3b8';
        tabNew.style.boxShadow = tab === 'new' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none';
        tabGroup.style.background = tab === 'group' ? 'white' : 'transparent';
        tabGroup.style.color = tab === 'group' ? '#6366f1' : '#94a3b8';
        tabGroup.style.boxShadow = tab === 'group' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none';

        document.getElementById('groupDetailsForm').style.display = tab === 'group' ? 'block' : 'none';
        document.getElementById('groupModalFooter').style.display = tab === 'group' ? 'flex' : 'none';
        document.getElementById('selectedGroupUsers').style.display = tab === 'group' ? 'flex' : 'none';

        this.selectedGroupUsers = [];
        this.renderSelectedGroupUsers();
        document.getElementById('newChatSearch').value = '';

        // Reload followed users list for the current tab
        this.loadFollowedUsers();
    }

    async handleUserSearch(query) {
        const resultsEl = document.getElementById('userSearchResults');

        // If query is empty/very short, filter locally from followed users
        if (query.trim().length < 2) {
            if (this._followedUsers && this._followedUsers.length > 0) {
                const filtered = query.trim().length === 0 ? this._followedUsers :
                    this._followedUsers.filter(u =>
                        u.name.toLowerCase().includes(query.toLowerCase()) ||
                        (u.username || '').toLowerCase().includes(query.toLowerCase())
                    );
                this.renderUserList(filtered, resultsEl);
            } else {
                resultsEl.innerHTML = '<div class="text-center text-gray-500 py-4 text-sm">Type a name to search all users...</div>';
            }
            return;
        }

        // First filter from followed list locally
        if (this._followedUsers && this._followedUsers.length > 0) {
            const localMatches = this._followedUsers.filter(u =>
                u.name.toLowerCase().includes(query.toLowerCase()) ||
                (u.username || '').toLowerCase().includes(query.toLowerCase())
            );
            if (localMatches.length > 0) {
                this.renderUserList(localMatches, resultsEl);
                return;
            }
        }

        // Fall back to global search
        resultsEl.innerHTML = '<div class="text-center text-gray-500 py-4 text-sm"><div class="spinner-pink mx-auto"></div></div>';
        try {
            const response = await fetch(`/api/search/users?q=${encodeURIComponent(query)}`);
            const result = await response.json();
            const data = result.data || result.users || [];
            if (data.length > 0) {
                this.renderUserList(data, resultsEl);
            } else {
                resultsEl.innerHTML = '<div class="text-center text-gray-500 py-4 text-sm">No users found.</div>';
            }
        } catch (err) {
            resultsEl.innerHTML = '<div class="text-center text-red-500 py-4 text-sm">Error searching.</div>';
        }
    }

    async selectUserFromSearch(userId, name, avatar) {
        if (this.newChatTab === 'new') {
            // Start direct chat
            try {
                const res = await fetch('/api/messages/start', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ partnerId: userId })
                });
                const result = await res.json();
                if (result.status === 'success') {
                    this.closeNewChatModal(true);
                    this.loadInbox().then(() => {
                        this.openChat(result.data.conversationId);
                    });
                }
            } catch (err) { console.error(err); }
        } else {
            // Group chat selection
            const exists = this.selectedGroupUsers.findIndex(u => u.id === userId);
            if (exists >= 0) {
                this.selectedGroupUsers.splice(exists, 1);
            } else {
                this.selectedGroupUsers.push({ id: userId, name, avatar });
            }
            this.renderSelectedGroupUsers();
            // Re-render search results to toggle checkbox
            this.handleUserSearch(document.getElementById('newChatSearch').value);
        }
    }

    renderSelectedGroupUsers() {
        const container = document.getElementById('selectedGroupUsers');
        if (this.selectedGroupUsers.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }
        container.style.display = 'flex';
        container.innerHTML = this.selectedGroupUsers.map(u => `
            <div class="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs flex items-center gap-1">
                ${u.name.split(' ')[0]}
                <i class="bi bi-x cursor-pointer" onclick="event.stopPropagation(); sparkChat.selectUserFromSearch('${u.id}')"></i>
            </div>
        `).join('');
    }

    async submitCreateGroup() {
        const name = document.getElementById('groupNameInput').value;
        const fileRef = document.getElementById('groupIconInput').files[0];
        
        if (!name || this.selectedGroupUsers.length === 0) {
            alert('Please provide a group name and select at least one member!');
            return;
        }

        const formData = new FormData();
        formData.append('name', name);
        formData.append('members', JSON.stringify(this.selectedGroupUsers.map(u => u.id)));
        if (fileRef) formData.append('pfp', fileRef);

        try {
            const res = await fetch('/api/groupChat', {
                method: 'POST',
                body: formData
            });
            const result = await res.json();
            if (result.status === 'success') {
                this.closeNewChatModal(true);
                this.loadInbox().then(() => {
                    this.openChat(result.data.chat.chat_id);
                });
            } else {
                alert('Group creation failed: ' + result.error);
            }
        } catch (err) {
            console.error(err);
        }
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
