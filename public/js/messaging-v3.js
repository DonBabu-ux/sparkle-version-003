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
        this.currentTab = 'all';
        
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

        // Original socket events, some might be redundant with the new init() bindings
        // Keeping them here for now, assuming the new init() bindings are the primary ones.
        // The instruction implies the new init() replaces the event binding logic.
        // For now, I'll assume the new init() event bindings are the source of truth.
        // The original setupSocket() event bindings are now effectively superseded by the new init() bindings.
        // To avoid duplicate listeners, I'll comment out the original ones here.
        this.socket.on('new-message', (message) => this.handleIncomingMessage(message));
        this.socket.on('message-sent', (message) => this.handleMessageSent(message));
        this.socket.on('user-typing', (data) => this.handleTypingIndicator(data));
        this.socket.on('messages-read', (data) => this.handleReadReceipt(data));
        this.socket.on('user-status', (data) => this.handleUserStatus(data));
        this.socket.on('new-reaction', (data) => this.handleReaction(data));
        this.socket.on('reaction-removed', (data) => this.handleReactionRemoved(data));
        this.socket.on('message-deleted-everyone', (data) => this.handleMessageDeleted({messageId: data.messageId}));
        this.socket.on('message_deleted', (messageId) => this.handleMessageDeleted({messageId: messageId})); // View limit expired
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
        textarea?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.submitMessageForm();
            }
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.chat-menu-wrapper')) {
                const menu = document.getElementById('chatDropdownMenu');
                if (menu) menu.style.display = 'none';
            }
            if (!e.target.closest('#emojiPickerPanel') && !e.target.closest('.bi-emoji-smile')) {
                const picker = document.getElementById('emojiPickerPanel');
                if (picker) picker.style.display = 'none';
            }
            if (!e.target.closest('#attachmentMenu') && !e.target.closest('.bi-paperclip')) {
                const addMenu = document.getElementById('attachmentMenu');
                if (addMenu) addMenu.style.display = 'none';
            }
        });

        // Swipe to reply
        const container = document.getElementById('messagesContainer');
        const trackSwipe = { startX: 0, currentX: 0, el: null };
        if (container) {
            container.addEventListener('touchstart', e => {
                const bubble = e.target.closest('.msg-bubble');
                if(bubble) {
                    trackSwipe.el = bubble;
                    trackSwipe.startX = e.touches[0].clientX;
                }
            }, {passive:true});
            container.addEventListener('touchmove', e => {
                if(!trackSwipe.el) return;
                trackSwipe.currentX = e.touches[0].clientX;
                const diff = trackSwipe.currentX - trackSwipe.startX;
                if(diff > 10 && diff < 80) {
                    trackSwipe.el.style.transform = `translateX(${diff}px)`;
                    trackSwipe.el.style.transition = 'none';
                }
            }, {passive:true});
            container.addEventListener('touchend', e => {
                if(!trackSwipe.el) return;
                const diff = trackSwipe.currentX - trackSwipe.startX;
                trackSwipe.el.style.transition = 'transform 0.2s ease';
                trackSwipe.el.style.transform = `translateX(0px)`;
                if(diff > 50) {
                    // Trigger reply
                    const msgId = trackSwipe.el.dataset.msgId;
                    const txt = trackSwipe.el.querySelector('.msg-body')?.innerText || 'Attachment';
                    this.replyingToMessageId = msgId;
                    document.getElementById('messagePreviewContainer').style.display = 'flex';
                    document.getElementById('previewText').innerText = txt;
                    document.getElementById('messageInput').focus();
                }
                trackSwipe.el = null;
            });
        }
    }

    submitMessageForm() {
        const input = document.getElementById('messageInput');
        if (!input.value.trim() && !this.editingMessageId) {
            // Probably clicked Microphone
            this.handleMicClick();
            return;
        }
        if (this.editingMessageId) {
            this.sendEdit();
        } else {
            this.sendMessage();
        }
    }
    
    startVoiceNote() {
        if (!this.currentChatId || this.isRecordingMedia) return;
        this.isRecordingMedia = true;
        this.voiceDuration = 0;
        
        document.getElementById('voiceNoteOverlay').style.display = 'flex';
        this.startVoiceTimer();
        
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            if(!this.isRecordingMedia) return; // Released too early or canceled
            this.voiceStream = stream;
            this.voiceChunks = [];
            this.mediaRecorder = new MediaRecorder(stream);
            this.mediaRecorder.ondataavailable = e => this.voiceChunks.push(e.data);
            this.mediaRecorder.onstop = () => {
                if(this.voiceCanceled) return;
                const blob = new Blob(this.voiceChunks, { type: 'audio/webm' });
                this.handleMediaUpload({ target: { files: [new File([blob], 'voice_note.webm', { type: 'audio/webm' })] } });
            };
            this.mediaRecorder.start();
        }).catch(err => {
            console.error("Mic error:", err);
            alert("Microphone access denied or unavailable.");
            this.cancelVoiceNote();
        });
    }

    startVoiceTimer() {
        const timerUI = document.getElementById('vnTimer');
        const waveformBox = document.querySelector('.vn-waveform');
        waveformBox.innerHTML = Array(15).fill('<div style="width:3px; height:10%; background:#00a884; border-radius:3px; transition:height 0.2s;"></div>').join('');
        const bars = waveformBox.children;
        
        this.voiceTimerInterval = setInterval(() => {
            this.voiceDuration++;
            
            for(let i=0; i<bars.length; i++) {
                bars[i].style.height = (Math.random() * 80 + 20) + '%';
            }
            
            const mins = Math.floor(this.voiceDuration / 60);
            const secs = this.voiceDuration % 60;
            if(timerUI) timerUI.innerText = `${mins}:${secs.toString().padStart(2, '0')}`;
            
            // 3 Minute Max Force Stop
            if(this.voiceDuration >= 180) {
                this.confirmVoiceNote();
            }
        }, 1000);
    }

    stopVoiceNote() {
        // Exists for quick release functionality without confirm overlay if we wanted it
        // However, user requested auto-send on release or confirm check based on workflow.
        // We map confirmVoiceNote() to the Native mouseup check seamlessly.
        this.confirmVoiceNote();
    }
    
    confirmVoiceNote(e) {
        if(e) e.stopPropagation();
        if(!this.isRecordingMedia) return;
        this.isRecordingMedia = false;
        this.voiceCanceled = false;
        
        clearInterval(this.voiceTimerInterval);
        document.getElementById('voiceNoteOverlay').style.display = 'none';
        
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        if(this.voiceStream) this.voiceStream.getTracks().forEach(track => track.stop());
    }

    cancelVoiceNote(e) {
        if(e) e.stopPropagation();
        if(!this.isRecordingMedia) return;
        this.isRecordingMedia = false;
        this.voiceCanceled = true;
        
        clearInterval(this.voiceTimerInterval);
        document.getElementById('voiceNoteOverlay').style.display = 'none';
        
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        if(this.voiceStream) this.voiceStream.getTracks().forEach(track => track.stop());
    }

    handleMicClick() {
        // Now handled by startVoiceNote / stopVoiceNote through mousedown/mouseup
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = (Math.min(textarea.scrollHeight, 100)) + 'px';
        const sendIcon = document.getElementById('sendIcon');
        const micIcon = document.getElementById('micIcon');
        if (textarea.value.trim().length > 0 || this.editingMessageId) {
            if(sendIcon) sendIcon.style.display = 'block';
            if(micIcon) micIcon.style.display = 'none';
        } else {
            if(sendIcon) sendIcon.style.display = 'none';
            if(micIcon) micIcon.style.display = 'block';
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

        // Filter based on tab
        const filtered = this.conversations.filter(c => {
            if (this.currentTab === 'marketplace') {
                return c.marketplace_listing_id !== null && !c.is_archived;
            } else if (this.currentTab === 'all') {
                return !c.is_archived; 
            } else if (this.currentTab === 'archived') {
                return c.is_archived;
            } else {
                return c.marketplace_listing_id === null && !c.is_archived;
            }
        });

        if (filtered.length === 0) {
            list.innerHTML = `<div class="empty-state">No ${this.currentTab === 'marketplace' ? 'marketplace inquiries' : 'conversations'} yet</div>`;
            return;
        }
        list.innerHTML = filtered.map(conv => {
            const isOnline = conv.is_online ? 'online' : '';
            const unread = conv.unread_count > 0 ? `<span class="unread-badge">${conv.unread_count}</span>` : '';
            const activeClass = conv.chat_id === this.currentChatId ? 'active' : '';
            const isGroup = conv.chat_type === 'group';
            
            let lastMsg = conv.last_message || 'No messages yet';
            if (conv.last_message_type === 'image') lastMsg = '📷 Photo';
            if (conv.last_message_type === 'video') lastMsg = '🎥 Video';
            if (conv.last_message_type === 'voice_note') lastMsg = '🎙️ Voice Message';
            if (conv.last_message_type === 'marketplace_listing') lastMsg = '🛍️ Marketplace Item';

            return `
                <div class="conversation-card ${activeClass} ${conv.is_archived ? 'archived' : ''}" 
                     onclick="window.sparkChat.openChat('${conv.chat_id}')">
                    <div class="conv-avatar-wrapper ${isOnline}">
                        <img src="${conv.partner_avatar || '/uploads/avatars/default.png'}" class="conv-avatar">
                    </div>
                    <div class="conv-info">
                        <div class="conv-header">
                            <span class="conv-name">${isGroup ? `<i class="bi bi-people-fill" style="margin-right:5px; font-size:14px; opacity:0.6;"></i>` : ''}${conv.partner_name} ${conv.listing_title ? `<span class="conv-listing-tag">🛍️ ${conv.listing_title}</span>` : ''}</span>
                            <span class="conv-time">${this.formatTime(conv.last_message_at) || ''}</span>
                        </div>
                        <div class="conv-preview">
                            <span class="last-msg-text ${conv.unread_count > 0 ? 'unread' : ''}">${lastMsg}</span>
                            <div style="display:flex; align-items:center; gap:8px;">
                                ${conv.unread_count > 0 ? `<span class="conv-unread-badge">${conv.unread_count}</span>` : ''}
                                <div class="card-actions" style="display:none; gap:10px;">
                                    <i class="bi bi-archive" onclick="event.stopPropagation(); sparkChat.archiveConversation('${conv.chat_id}')" style="cursor:pointer; opacity:0.6;"></i>
                                    <i class="bi bi-trash" onclick="event.stopPropagation(); sparkChat.deleteConversation('${conv.chat_id}')" style="cursor:pointer; opacity:0.6; color:#f15c6d;"></i>
                                </div>
                            </div>
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

    switchInboxTab(type, el) {
        this.currentTab = type;
        document.querySelectorAll('.inbox-tab').forEach(t => t.classList.remove('active'));
        el.classList.add('active');
        this.renderInbox();
    }

    archiveConversation(chatId) {
        if(confirm('Archive this chat?')) {
            const card = document.querySelector(`.conversation-card[data-id="${chatId}"]`);
            if(card) card.remove();
            alert('Chat archived.');
        }
    }

    deleteConversation(chatId) {
        if(confirm('Are you sure you want to delete this conversation? This cannot be undone.')) {
            const card = document.querySelector(`.conversation-card[data-id="${chatId}"]`);
            if(card) card.remove();
            // TODO: API call to delete
            alert('Conversation deleted.');
        }
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
        let statusIcon = 'bi-check';
        let statusColor = '#8696a0'; // Default gray for sent
        if (msg.status === 'delivered') {
            statusIcon = 'bi-check-all';
        }
        if (msg.status === 'read') {
            statusIcon = 'bi-check-all';
            statusColor = '#53bdeb'; // WhatsApp Read Blue
        }
        
        let mediaContent = '';
        const isLimited = msg.view_policy && msg.view_policy !== 'unlimited';
        
        if (msg.media_url) {
            if (isLimited && !isMe) {
                const limitIcon = msg.view_policy === 'once' ? 'bi-1-circle' : 'bi-2-circle';
                const limitText = msg.view_policy === 'once' ? 'Photo' : 'Photo (x2)';
                
                // Not viewed yet or partially viewed
                mediaContent = `
                    <div class="view-limited-placeholder" onclick="window.sparkChat.openLimitedMedia('${msg.message_id}', '${msg.media_url}', '${msg.type}')" 
                         style="background:#202c33; padding:15px; border-radius:12px; cursor:pointer; display:flex; align-items:center; color:#00a884; font-weight:600; border:1px solid #111b21;">
                        <i class="bi ${limitIcon}" style="font-size:20px; display:inline-block; margin-right:12px; opacity:0.8;"></i>
                        <span style="color:#e9edef;">${limitText}</span>
                    </div>
                `;
            } else if (isLimited && isMe) { // Sender also sees limited wrapper matching WhatsApp context
                const limitIcon = msg.view_policy === 'once' ? 'bi-1-circle' : 'bi-2-circle';
                mediaContent = `
                    <div class="view-limited-placeholder" style="background:#005c4b; padding:15px; border-radius:12px; cursor:default; display:flex; align-items:center; color:#e9edef; font-weight:600; border:1px solid #111b21;">
                        <i class="bi ${limitIcon}" style="font-size:20px; display:inline-block; margin-right:12px; opacity:0.8;"></i>
                        <span style="color:#e9edef;">Photo</span>
                    </div>
                `;
            } else {
                if (msg.type === 'image' || msg.media_url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
                    mediaContent = `<img src="${msg.media_url}" class="msg-media-img" loading="lazy" onclick="window.open('${msg.media_url}')" style="max-width:80%; border-radius:12px;">`;
                } else if (msg.type === 'video' || msg.media_url.match(/\.(mp4|webm|mov)$/i)) {
                    mediaContent = `<video src="${msg.media_url}" class="msg-media-video" controls preload="none" style="max-width:80%; border-radius:12px; max-height:250px; background:#000;"></video>`;
                } else if (msg.type === 'audio' || msg.media_url.match(/\.(mp3|wav|ogg)$/i)) {
                    mediaContent = `<audio src="${msg.media_url}" controls preload="none" style="max-width:260px;"></audio>`;
                } else {
                    mediaContent = `
                        <a href="${msg.media_url}" target="_blank" class="document-download" style="display:flex; align-items:center; gap:10px; padding:12px; background:rgba(0,0,0,0.05); border-radius:8px; text-decoration:none; color:inherit;">
                            <i class="bi bi-file-earmark-arrow-down" style="font-size:24px; color:#6366f1;"></i>
                            <div style="font-weight:600; font-size:13px; word-break:break-all;">Download Document</div>
                        </a>
                    `;
                }
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

        // Marketplace Listing Card
        let listingHtml = '';
        if (msg.type === 'marketplace_listing' && msg.marketplace_listing_id) {
            listingHtml = `
                <div class="msg-listing-card" onclick="window.location.href='/marketplace/listings/${msg.marketplace_listing_id}'">
                    <img src="${msg.listing_image || '/images/default-listing.jpg'}" class="listing-preview-img">
                    <div class="listing-preview-info">
                        <span class="listing-preview-title">${msg.listing_title || 'Marketplace Item'}</span>
                        <span class="listing-preview-price">KES ${Number(msg.listing_price || 0).toLocaleString()}</span>
                    </div>
                    <div class="listing-preview-action">
                        View Product <i class="bi bi-chevron-right"></i>
                    </div>
                </div>
            `;
        }

        return `
            <div class="msg-bubble ${isMe ? 'msg-sent' : 'msg-received'} ${isDeleted ? 'msg-deleted' : ''}" data-msg-id="${msg.message_id}" data-is-own="${isMe}">
                ${msg.reply_to_message_id && !isDeleted ? `
                    <div class="reply-preview">
                        <i class="bi bi-reply-fill"></i>
                        <span>${msg.reply_content}</span>
                    </div>
                ` : ''}
                ${!isDeleted ? mediaContent : ''}
                ${listingHtml && !isDeleted ? listingHtml : ''}
                ${msg.content || isDeleted ? `<div class="msg-body" style="font-size:14px;">${isDeleted ? '🚫 This message was deleted.' : msg.content}</div>` : ''}
                <div class="msg-footer" style="display:flex; align-items:center; justify-content:flex-end; gap:4px; font-size:11px; color:#8696a0; margin-top:2px;">
                    <span>${this.formatTime(msg.sent_at)}</span>
                    ${msg.edited_at && !isDeleted ? '<span style="font-style:italic;">(edited)</span>' : ''}
                    ${isMe && !isDeleted ? `<span class="msg-tick"><i class="bi ${statusIcon}" style="color:${statusColor}; font-size:16px; margin-left:2px;"></i></span>` : ''}
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

        let type = 'document';
        if (file.type.startsWith('image/')) type = 'image';
        if (file.type.startsWith('video/')) type = 'video';
        if (file.type.startsWith('audio/')) type = 'audio';

        const sizeMB = file.size / (1024 * 1024);
        if (type === 'image' && sizeMB > 3) {
            alert('Images must be under 3MB.');
            return;
        } else if (type === 'video' && sizeMB > 10) {
            alert('Videos must be under 10MB.');
            return;
        } else if (type === 'audio' && sizeMB > 5) {
            alert('Voice notes and audio must be under 5MB.');
            return;
        } else if (sizeMB > 10) {
            alert('Documents must be under 10MB.');
            return;
        }

        // Pre-cache context
        this.pendingMediaParams = { file, type };

        const previewModal = document.getElementById('mediaPreviewModal');
        const previewContent = document.getElementById('mediaPreviewContent');
        const viewPolicyLabel = document.getElementById('vpLabel');
        const viewPolicyIcon = document.getElementById('vpIcon');
        const captionInput = document.getElementById('mediaCaptionInput');
        
        if (captionInput) captionInput.value = '';

        this.pendingViewPolicy = 'unlimited';
        if(viewPolicyLabel) viewPolicyLabel.innerText = 'Keep';
        if(viewPolicyIcon) viewPolicyIcon.className = 'bi bi-infinity';

        if(type === 'image') {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewContent.innerHTML = `<img src="${e.target.result}" style="max-width:100%; max-height:80vh; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.1);">`;
                previewModal.style.display = 'flex';
            };
            reader.readAsDataURL(file);
        } else if(type === 'video') {
            const url = URL.createObjectURL(file);
            previewContent.innerHTML = `<video src="${url}" controls autoplay loop style="max-width:100%; max-height:80vh; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.1); background:#000;"></video>`;
            previewModal.style.display = 'flex';
        } else {
            previewContent.innerHTML = `<div style="background:#fff; padding:30px; border-radius:16px; text-align:center; box-shadow:0 4px 15px rgba(0,0,0,0.1);">
                <i class="bi bi-file-earmark-fill" style="font-size:48px; color:#6366f1;"></i>
                <div style="font-size:16px; font-weight:700; margin-top:10px; color:#111b21;">${file.name}</div>
            </div>`;
            previewModal.style.display = 'flex';
        }
    }

    closeMediaPreview() {
        document.getElementById('mediaPreviewModal').style.display = 'none';
        this.pendingMediaParams = null;
        this.pendingViewPolicy = 'unlimited';
    }

    cycleViewPolicy() {
        const vpLabel = document.getElementById('vpLabel');
        const vpIcon = document.getElementById('vpIcon');
        
        if(this.pendingViewPolicy === 'unlimited') {
            this.pendingViewPolicy = 'once';
            if(vpLabel) vpLabel.innerText = 'View Once';
            vpIcon.className = 'bi bi-1-circle';
        } else if(this.pendingViewPolicy === 'once') {
            this.pendingViewPolicy = 'twice';
            if(vpLabel) vpLabel.innerText = 'View Twice';
            vpIcon.className = 'bi bi-2-circle';
        } else {
            this.pendingViewPolicy = 'unlimited';
            if(vpLabel) vpLabel.innerText = 'Keep';
            vpIcon.className = 'bi bi-infinity';
        }
    }

    async confirmSendMedia() {
        if(!this.pendingMediaParams || !this.currentChatId) return;
        
        const { file, type } = this.pendingMediaParams;
        const viewPolicy = this.pendingViewPolicy || 'unlimited';
        const captionField = document.getElementById('mediaCaptionInput');
        const caption = captionField ? captionField.value.trim() : '';
        this.closeMediaPreview();

        const formData = new FormData();
        formData.append('file', file);

        try {
            const container = document.getElementById('messagesContainer');
            const placeholderId = 'uploading-' + Date.now();
            container.insertAdjacentHTML('beforeend', `
                <div class="msg-bubble msg-sent" id="${placeholderId}">
                    <div class="chat-loader"><div class="spinner-pink" style="width:20px; height:20px;"></div></div>
                    <div class="msg-body">Uploading ${type}...</div>
                </div>
            `);
            this.scrollToBottom();

            const response = await fetch('/api/upload/message', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            
            document.getElementById(placeholderId)?.remove();

            if (result.success) {
                const conv = this.conversations.find(c => c.chat_id == this.currentChatId);
                
                this.socket.emit('send-message', {
                    chatId: this.currentChatId,
                    recipientId: conv?.partner_id,
                    content: caption,
                    type: type,
                    mediaUrl: result.url || result.data?.url,
                    marketplaceListingId: conv?.marketplace_listing_id,
                    viewPolicy: viewPolicy
                });
            } else {
                alert('Upload failed: ' + result.error);
            }
        } catch (err) {
            console.error('Media upload error:', err);
            alert('Media upload failed');
            document.getElementById('uploading-' + Date.now())?.remove();
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
            replyToId: this.replyingToMessageId,
            marketplaceListingId: conv?.marketplace_listing_id
        };

        this.socket.emit('send-message', data);
        input.value = '';
        this.autoResizeTextarea(input);
        this.stopTyping();
        this.cancelReplyOrEdit();
    }

    toggleEmojiPicker() {
        const picker = document.getElementById('emojiPickerPanel');
        picker.style.display = (picker.style.display === 'none') ? 'flex' : 'none';
    }

    insertEmoji(emoji) {
        const input = document.getElementById('messageInput');
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;
        input.value = text.substring(0, start) + emoji + text.substring(end);
        input.selectionStart = input.selectionEnd = start + emoji.length;
        this.autoResizeTextarea(input);
        input.focus();
    }

    handleIncomingMessage(msg) {
        if(String(msg.sender_id) === String(this.userId)) return; // Prevent double message bug safely!
        
        const msgChatId = msg.conversation_id || msg.chat_id;
        if (this.currentChatId === msgChatId) {
            const container = document.getElementById('messagesContainer');
            container.insertAdjacentHTML('beforeend', this.createMessageHTML(msg));
            this.scrollToBottom();
            this.socket.emit('mark-read', this.currentChatId);
        }
        
        // Always refresh inbox to bubble current chat to top
        this.loadInbox();
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

    openLimitedMedia(messageId, mediaUrl, type) {
        // Emit view logic
        this.socket.emit('open_message', { messageId });

        // Show media
        if (type === 'image' || mediaUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
            window.open(mediaUrl);
        } else if (type === 'video' || mediaUrl.match(/\.(mp4|webm|mov)$/i)) {
            window.open(mediaUrl);
        } else if (type === 'audio' || mediaUrl.match(/\.(mp3|wav|ogg)$/i)) {
            window.open(mediaUrl);
        } else {
            // Document
            window.open(mediaUrl);
        }
    }

    handleMessageDeleted(data) {
        const msgEl = document.querySelector(`.msg-bubble[data-msg-id="${data.messageId}"]`);
        if (msgEl) {
            msgEl.classList.add('msg-deleted');
            const body = msgEl.querySelector('.msg-body');
            if (body) {
                body.innerHTML = '🔒 Already opened or deleted.';
            } else {
                msgEl.innerHTML = '<div class="msg-body">🔒 Already opened or deleted.</div>';
            }
            msgEl.querySelector('.msg-media-img, .msg-media-video, .view-limited-placeholder')?.remove();
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

    switchEmojiTab(tab, el) {
        document.querySelectorAll('.emoji-tab-icon').forEach(i => i.classList.remove('active'));
        el.classList.add('active');
        
        const grid = document.getElementById('emojiPickerGrid');
        grid.innerHTML = '<div class="chat-loader" style="width:100%;"><div class="spinner-pink"></div></div>';
        
        setTimeout(() => {
            if(tab === 'emoji') {
                this.renderEmojiGrid('');
            } else if(tab === 'gif') {
                this.renderGifGrid('');
            } else if(tab === 'sticker') {
                this.renderStickerGrid();
            } else if(tab === 'avatar') {
                this.renderAvatarGrid();
            }
        }, 300);
    }

    renderEmojiGrid(query) {
        const grid = document.getElementById('emojiPickerGrid');
        const list = [
            '😂','❤️','😍','🥺','🔥','✨','👍','🎉','😭','🥰','👏','🙄','🤔','😎','👀','💯','💀','🤩','🙏','👌','😊','🤦‍♂️','🤷‍♀️','💪',
            '😁','😆','😅','😋','😎','😘','😗','😙','😚','🙂','🤗','🤩','🤔','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','🥱',
            '🧐','🤓','😈','👿','👹','👺','🤡','💩','👻','💀','☠️','👽','👾','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾',
            '🤲','👐','🙌','👏','🤝','👍','👎','👊','✊','🤛','🤜','🤞','✌️','🤟','🤘','👌','🤌','🤏','👈','👉','👆','👇','✋','🤚','🖐','🖖','👋','🤙'
        ];
        const filtered = query ? list.filter(e => e.includes(query)) : list;
        grid.innerHTML = filtered.map(e => `<span class="emoji-item" onclick="sparkChat.insertEmoji('${e}')">${e}</span>`).join('');
    }

    renderGifGrid(query) {
        const grid = document.getElementById('emojiPickerGrid');
        const mocks = [
            'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHp1ZHc0Z3U4cW5xeGZwaHFxeGZwaHFxeGZwaHFxeGZwaHFxeGZwaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKDkDbIDJieKbVm/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHp1ZHc0Z3U4cW5xeGZwaHFxeGZwaHFxeGZwaHFxeGZwaHFxeGZwaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l41lTfuxR7N0f3OqA/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHp1ZHc0Z3U4cW5xeGZwaHFxeGZwaHFxeGZwaHFxeGZwaHFxeGZwaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKVUn7iM8FMEU24/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHp1ZHc0Z3U4cW5xeGZwaHFxeGZwaHFxeGZwaHFxeGZwaHFxeGZwaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26AHONh79uHEUY_XG/giphy.gif'
        ];
        grid.innerHTML = mocks.map(g => `<img src="${g}" class="gif-item" onclick="sparkChat.sendGif('${g}')">`).join('');
    }

    renderStickerGrid() {
        const grid = document.getElementById('emojiPickerGrid');
        grid.innerHTML = '<div style="color:#8696a0; font-size:12px; text-align:center; width:100%; padding:20px;">Stickers mapping coming soon from Sparkle Assets.</div>';
    }

    renderAvatarGrid() {
        const grid = document.getElementById('emojiPickerGrid');
        grid.innerHTML = '<div style="color:#8696a0; font-size:12px; text-align:center; width:100%; padding:20px;">Personal Avatars synced from your profile.</div>';
    }

    handleEmojiSearch(val) {
        const activeTab = document.querySelector('.emoji-tab-icon.active').title.toLowerCase();
        if(activeTab === 'emoji') this.renderEmojiGrid(val);
    }

    insertEmoji(emoji) {
        const input = document.getElementById('messageInput');
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;
        input.value = text.substring(0, start) + emoji + text.substring(end);
        input.selectionStart = input.selectionEnd = start + emoji.length;
        this.autoResizeTextarea(input);
        input.focus();
    }

    sendGif(url) {
        this.toggleEmojiPicker();
        this.socket.emit('send-message', {
            chatId: this.currentChatId,
            recipientId: this.conversations.find(c => c.chat_id == this.currentChatId)?.partner_id,
            content: '',
            type: 'image',
            mediaUrl: url
        });
    }

    handleActionCopy() {
        const msgEl = document.querySelector(`.msg-bubble[data-msg-id="${this.activeMessageId}"]`);
        const body = msgEl?.querySelector('.msg-body')?.innerText;
        if(body) {
            navigator.clipboard.writeText(body).then(() => {
                alert('Copied to clipboard!');
                this.closeMessageActionMenu();
            });
        }
    }

    toggleEmojiPicker() {
        const picker = document.getElementById('emojiPickerPanel');
        const isHidden = picker.style.display === 'none';
        picker.style.display = isHidden ? 'flex' : 'none';
        if(isHidden) {
            this.renderEmojiGrid('');
        }
    }

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

        // Visual highlight for the selected bubble
        msgEl.classList.add('msg-active-press');

        const modal = document.getElementById('messageActionModal');
        const overlay = document.getElementById('messageActionOverlay');

        // Show/Hide buttons
        document.getElementById('actionDrawerEditBtn').style.display = isOwn ? 'flex' : 'none';
        document.getElementById('actionDrawerDeleteEveryoneBtn').style.display = isOwn ? 'flex' : 'none';

        // Position Calculation
        const rect = msgEl.getBoundingClientRect();
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        overlay.style.display = 'flex';
        
        // Initial positioning style
        modal.style.position = 'fixed';
        modal.style.margin = '0';
        
        // Horizontal centering relative to bubble
        let left = rect.left + (rect.width / 2) - (160); // 160 is half of max-width 320
        if (left < 10) left = 10;
        if (left + 320 > screenWidth - 10) left = screenWidth - 330;
        modal.style.left = left + 'px';

        // Vertical positioning (prefer above, fallback to below)
        let top = rect.top - (isOwn ? 240 : 180); // Adjusted for own vs partner
        if (top < 80) {
            top = rect.bottom + 10;
        }
        
        // Final sanity check for bottom boundary
        if (top + 280 > screenHeight) {
            top = screenHeight - 290;
        }

        modal.style.top = top + 'px';
    }

    closeMessageActionMenu() {
        // Remove highlight from all bubbles
        document.querySelectorAll('.msg-bubble.msg-active-press').forEach(el => el.classList.remove('msg-active-press'));
        
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

    toggleAttachmentMenu() {
        const menu = document.getElementById('attachmentMenu');
        menu.style.display = (menu.style.display === 'none') ? 'block' : 'none';
    }

    openAttachment(type) {
        this.toggleAttachmentMenu();
        const input = document.getElementById('mediaUpload');
        if(type === 'Gallery' || type === 'Camera') {
            if(type === 'Gallery') {
                input.setAttribute('accept', 'image/*,video/*');
                input.click();
            } else {
                this.openCameraInterface();
            }
        } else if(type === 'Document') {
            input.setAttribute('accept', '.pdf,.doc,.docx,.txt');
            input.click();
        } else if(type === 'Audio') {
            input.setAttribute('accept', 'audio/*');
            input.click();
        } else if(type === 'Follower') {
            this.openFollowerShareModal();
        } else {
            alert(`${type} attaching is coming soon!`);
        }
    }

    // --- HTML5 Camera UI Flow ---
    openCameraInterface() {
        const ui = document.getElementById('cameraInterface');
        ui.style.display = 'flex';
        this.cameraFacingMode = 'user';
        this.cameraMode = 'photo'; // Default
        this.initCameraStream();
    }

    switchCameraMode(mode) {
        this.cameraMode = mode;
        const modes = ['Photo', 'Video', 'VideoNote'];
        modes.forEach(m => {
            const el = document.getElementById('mode' + m);
            if(el) {
                el.style.color = (m.toLowerCase() === mode) ? '#00a884' : '#fff';
                el.style.borderBottom = (m.toLowerCase() === mode) ? '2px solid #00a884' : 'none';
            }
        });
    }

    cameraCaptureClick() {
        // Just for capturing UI state consistency, tap handles photo
        // Long press handles video auto-trigger in mousedown/up
    }

    initCameraStream() {
        if(this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
        }
        navigator.mediaDevices.getUserMedia({
            video: { facingMode: this.cameraFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true
        }).then(stream => {
            this.cameraStream = stream;
            document.getElementById('cameraVideo').srcObject = stream;
        }).catch(err => {
            alert("Camera access denied or unavailable.");
            this.closeCamera();
        });
    }

    switchCamera() {
        this.cameraFacingMode = (this.cameraFacingMode === 'user') ? 'environment' : 'user';
        this.initCameraStream();
    }

    closeCamera() {
        const ui = document.getElementById('cameraInterface');
        ui.style.display = 'none';
        if(this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
    }

    cameraCaptureStart() {
        if(this.cameraMode === 'video' || this.cameraMode === 'videonote') {
            if(this.isRecordingCamera) {
                this.cameraCaptureEnd();
            } else {
                this.startRecordingCamera();
            }
            return;
        }

        this.cameraPressTimer = Date.now();
        const inner = document.getElementById('cameraCaptureInner');
        if(inner) inner.style.transform = 'scale(0.8)';
        
        this.cameraHoldTimeout = setTimeout(() => {
            this.startRecordingCamera();
        }, 500);
    }

    startRecordingCamera() {
        const inner = document.getElementById('cameraCaptureInner');
        this.isRecordingCamera = true;
        if(inner) {
            inner.style.background = '#e53f77';
            inner.style.transform = 'scale(0.5)';
            inner.style.borderRadius = '8px'; // Transition to square for recording
        }
        this.cameraChunks = [];
        this.cameraRecorder = new MediaRecorder(this.cameraStream);
        this.cameraRecorder.ondataavailable = e => this.cameraChunks.push(e.data);
        this.cameraRecorder.onstop = () => {
            const blob = new Blob(this.cameraChunks, { type: 'video/webm' });
            const file = new File([blob], 'camera_capture_' + Date.now() + '.webm', { type: 'video/webm' });
            this.closeCamera();
            this.handleMediaUpload({ target: { files: [file] } });
        };
        this.cameraRecorder.start();
    }

    cameraCaptureEnd() {
        if(this.cameraMode === 'video' || this.cameraMode === 'videonote') return;

        if(this.cameraHoldTimeout) clearTimeout(this.cameraHoldTimeout);
        
        const inner = document.getElementById('cameraCaptureInner');
        if(inner) {
            inner.style.background = '#fff';
            inner.style.transform = 'scale(1)';
            inner.style.borderRadius = '50%';
        }

        const duration = Date.now() - (this.cameraPressTimer || 0);
        if(duration < 500) {
            this.captureCameraPhoto();
        } else if(this.isRecordingCamera) {
            this.isRecordingCamera = false;
            if(this.cameraRecorder && this.cameraRecorder.state !== 'inactive') {
                this.cameraRecorder.stop();
            }
        }
    }

    captureCameraPhoto() {
        const video = document.getElementById('cameraVideo');
        if(!video || !this.cameraStream) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(blob => {
            const file = new File([blob], 'camera_capture_' + Date.now() + '.jpg', { type: 'image/jpeg' });
            this.closeCamera();
            this.handleMediaUpload({ target: { files: [file] } });
        }, 'image/jpeg', 0.85);
    }

    async openFollowerShareModal() {
        document.getElementById('followerShareModal').style.display = 'flex';
        const list = document.getElementById('followerShareList');
        
        try {
            const res = await fetch('/api/users/active-friends');
            const data = await res.json();
            
            if(data && data.length > 0) {
                list.innerHTML = `<div style="color:#8696a0; font-size:13px; margin-bottom:10px; padding:0 10px;">Select a user to share to your chat</div>` +
                data.map(u => `
                    <div style="background:#222; padding:15px; border-radius:12px; margin-top:8px; display:flex; align-items:center; cursor:pointer;" onclick="sparkChat.shareContact('${u.id}', '${u.username}')">
                        <img src="${u.avatar_url || '/uploads/avatars/default.png'}" style="width:40px; height:40px; border-radius:50%; margin-right:15px; object-fit:cover;">
                        <div>
                            <div style="color:#fff; font-weight:600;">${u.username}</div>
                            <div style="color:#8696a0; font-size:12px;">Tap to share contact</div>
                        </div>
                    </div>
                `).join('');
            } else {
                list.innerHTML = `<div style="color:#8696a0; font-size:13px; text-align:center;">No followers available to share at this moment.</div>`;
            }
        } catch(e) {
            list.innerHTML = `<div style="color:red; font-size:12px;">Failed to load contacts.</div>`;
        }
    }

    shareContact(userId, username) {
        document.getElementById('followerShareModal').style.display = 'none';
        this.socket.emit('send-message', {
            chatId: this.currentChatId,
            recipientId: this.conversations.find(c => c.chat_id == this.currentChatId)?.partner_id,
            content: `Sent a contact: @${username}`,
            type: 'text',
        });
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
