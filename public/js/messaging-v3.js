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
        this.typingUsers = {}; // chatId -> Set of typing usernames

        this.init();
    }

    async init() {
        this.setupSocket();
        this.bindEvents();
        await this.loadInbox();
        this.checkUrlParameters();
        this.startUpdateTimeLoop();
    }

    async checkUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const chatId = urlParams.get('chat');
        const userId = urlParams.get('user');
        const messagePayload = urlParams.get('message');
        const mktParam = urlParams.get('mkt');

        // Decode structured marketplace payload if present
        let marketplaceData = null;
        if (mktParam) {
            try {
                marketplaceData = JSON.parse(decodeURIComponent(atob(mktParam)));
            } catch (e) {
                console.warn('Failed to decode mkt param:', e);
            }
        }

        const applyPreFill = (chatIdOpened) => {
            if (marketplaceData) {
                // Send as a rich structured card after a short render delay
                setTimeout(() => this.sendMarketplaceCard(marketplaceData), 600);
            } else if (messagePayload) {
                setTimeout(() => {
                    const input = document.getElementById('messageInput');
                    if (input) {
                        input.value = messagePayload;
                        if (typeof this.autoResizeTextarea === 'function') {
                            this.autoResizeTextarea(input);
                        }
                        input.focus();
                    }
                }, 400);
            }
        };

        const openChatForUser = async (uid) => {
            try {
                // 1. Get or create conversation
                let chatId = null;
                const response = await fetch(`/api/messages/chat/${uid}`);
                const result = await response.json();
                
                if (result.status === 'success' && result.chatId) {
                    chatId = result.chatId;
                } else {
                    const startRes = await fetch('/api/messages/start', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ partnerId: uid })
                    });
                    const startResult = await startRes.json();
                    if (startResult.status === 'success') {
                        chatId = startResult.data.conversationId;
                    }
                }

                if (!chatId) return null;

                // 2. Ensure we have the conversation object in our local list for UI metadata
                let conv = this.conversations.find(c => c.chat_id === chatId);
                if (!conv) {
                    console.log('✨ Initializing new conversation metadata for UID', uid);
                    const userRes = await fetch(`/api/users/${uid}`);
                    const userResult = await userRes.json();
                    const partner = userResult.data || userResult.user;

                    if (partner) {
                        conv = {
                            chat_id: chatId,
                            chat_type: 'personal',
                            partner_id: uid,
                            partner_name: partner.name,
                            partner_username: partner.username,
                            partner_avatar: partner.avatar_url,
                            is_online: partner.is_online || 0,
                            last_seen_at: partner.last_seen_at,
                            last_message: '',
                            last_message_at: null,
                            unread_count: 0,
                            is_pinned: 0,
                            is_muted: 0,
                            is_archived: 0
                        };
                        this.conversations.unshift(conv);
                        this.renderInbox();
                    }
                }

                // 3. Open the chat
                await this.openChat(chatId);
                return chatId;
            } catch (err) {
                console.error('Deep-link failed:', err);
            }
            return null;
        };

        if (chatId) {
            console.log('\uD83D\uDD17 Deep-link: Opening chat ID', chatId);
            await this.openChat(chatId);
            applyPreFill(chatId);
        } else if (userId) {
            console.log('\uD83D\uDD17 Deep-link: Initializing chat with user', userId);
            const resolvedId = await openChatForUser(userId);
            if (resolvedId) applyPreFill(resolvedId);
        }
    }

    sendMarketplaceCard(data) {
        if (!this.currentChatId || !data) return;
        const conv = this.conversations.find(c => c.chat_id == this.currentChatId);
        const recipientId = conv?.partner_id;
        // Use seller name from payload or chat partner; keep greeting clean (no user name suffix to avoid emoji encoding issues)
        const sellerName = data.sellerName || conv?.partner_name || 'there';

        // 1. Send warm greeting text first (like WhatsApp flow)
        const greeting = `Hi ${sellerName}, is this still available? 😊`;
        this.socket.emit('send-message', {
            chatId: this.currentChatId,
            recipientId,
            content: greeting,
            type: 'text'
        });

        // 2. After a short delay, send the rich product card as a text msg
        //    (type stored in content JSON so it works regardless of DB ENUM constraints)
        setTimeout(() => {
            this.socket.emit('send-message', {
                chatId: this.currentChatId,
                recipientId,
                content: JSON.stringify({ type: 'marketplace_inquiry', payload: data }),
                type: 'text'   // Use 'text' so the DB accepts it; type is embedded in the JSON
            });
        }, 300);
    }

    setupSocket() {
        // ─── Message Queue for offline resilience ───────────────────────────
        this._msgQueue = this._msgQueue || [];
        this._reconnectAttempts = 0;
        this._maxReconnectDelay = 30000;
        this._currentPickerTab = 'emoji'; 
        this._gifSearchTimer = null;      
        this._stickerSearchTimer = null;  

        // Get key from secure config
        this._giphyApiKey = (window.sparkConfig && window.sparkConfig.giphyKey) || 'V4AnAfCCCGEVjlUjiNMWWXCoW1JrAn4p';

        // Re-use connection if possible, otherwise init
        this.socket = window.socket || io({
            auth: { token: this.getCookie('sparkleToken') },
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
            timeout: 20000
        });

        window.socket = this.socket;

        // Cleanup legacy listeners to prevent duplication (Point 9)
        this.socket.off('connect');
        this.socket.off('disconnect');
        this.socket.off('new-message');
        this.socket.off('message-sent');
        this.socket.off('user-typing');
        this.socket.off('user-status');

        // ─── Connection Events ───────────────────────────────────────────────
        this.socket.on('connect', () => {
            console.log('🔌 Sparkle: Socket connected', this.socket.id);
            this._reconnectAttempts = 0;
            this._drainMessageQueue();

            // Re-join current chat room on reconnect
            if (this.currentChatId) {
                this.socket.emit('join-chat', this.currentChatId);
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.warn('🔌 Sparkle: Socket disconnected –', reason);
            this._stopHeartbeat();
            
            // Note: Socket.io's built-in reconnection will handle most cases.
            // Only force-reconnect if it's a server-side disconnect that needs a new session.
            if (reason === 'io server disconnect') {
                this.socket.connect();
            }
        });

        this.socket.on('reconnect', (attempt) => {
            console.log(`🔌 Sparkle: Reconnected after ${attempt} attempt(s)`);
            this._startHeartbeat();
        });

        this.socket.on('connect_error', (err) => {
            console.warn('🔌 Sparkle: Connection error –', err.message);
        });

        // Custom server-side pong response
        this.socket.on('sparkle-pong', () => {
            this._lastPong = Date.now();
        });

        // ─── Chat / Messaging Events ────────────────────────────────────────
        this.socket.on('new-message', (message) => this.handleIncomingMessage(message));
        this.socket.on('message-sent', (message) => this.handleMessageSent(message));
        this.socket.on('user-typing', (data) => this.handleTypingIndicator(data));
        this.socket.on('messages-read', (data) => this.handleReadReceipt(data));
        this.socket.on('messages-delivered', (data) => this.handleMessageDelivered(data));
        this.socket.on('message_view_update', (data) => this.handleViewUpdate(data));
        this.socket.on('user-status', (data) => this.handleUserStatus(data));
        this.socket.on('new-reaction', (data) => this.handleReaction(data));
        this.socket.on('reaction-removed', (data) => this.handleReactionRemoved(data));
        this.socket.on('message-deleted-everyone', (data) => this.handleMessageDeleted({ messageId: data.messageId }));
        this.socket.on('message_deleted', (messageId) => this.handleMessageDeleted({ messageId }));
        this.socket.on('disappearing_messages_update', (data) => this.handleDisappearingUpdate(data));
        this.socket.on('new_group_created', async (data) => {
            await this.loadInbox();
            if (data.chatId) this.socket.emit('join-chat', data.chatId);
        });

        // ─── Start heartbeat ─────────────────────────────────────────────────
        this._startHeartbeat();
    }

    // ─── Heartbeat: Custom ping every 25s ────────────────────────────────────
    _startHeartbeat() {
        this._stopHeartbeat();
        this._heartbeatInterval = setInterval(() => {
            if (!this.socket || !this.socket.connected) return;
            this._lastPing = Date.now();
            this.socket.emit('sparkle-ping');

            // Timeout check for sluggish connections (30s tolerance)
            setTimeout(() => {
                if (this._lastPong < this._lastPing - 29000) {
                    console.warn('🔌 Sparkle: Heartbeat delay detected — connection may be unstable');
                }
            }, 30000);
        }, 25000);
    }

    _stopHeartbeat() {
        if (this._heartbeatInterval) {
            clearInterval(this._heartbeatInterval);
            this._heartbeatInterval = null;
        }
    }

    // Rely on Socket.IO's built-in reconnection management; keep for reference but remove manual call in disconnect
    _scheduleReconnect() {
        // Obsolete manually called function, Socket.io manages this now
    }

    // ─── Message Queue: queue when offline, drain when reconnected ────────────
    _safeEmit(event, data, callback) {
        if (this.socket && this.socket.connected) {
            this.socket.emit(event, data, callback);
        } else {
            console.warn('🔌 Sparkle: Offline — queuing message for retry');
            this._msgQueue = this._msgQueue || [];
            this._msgQueue.push({ event, data, callback, ts: Date.now() });
        }
    }

    _drainMessageQueue() {
        if (!this._msgQueue || this._msgQueue.length === 0) return;
        console.log(`🔌 Sparkle: Draining ${this._msgQueue.length} queued message(s)`);
        const queue = [...this._msgQueue];
        this._msgQueue = [];
        queue.forEach(({ event, data, callback }) => {
            // Only retry send-message events (status events can be skipped)
            if (event === 'send-message') {
                this.socket.emit(event, data, callback);
            }
        });
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

        // Online/Offline status based on tab visibility
        document.addEventListener("visibilitychange", () => {
            if (this.socket && this.socket.connected) {
                const status = document.visibilityState === 'visible' ? 'online' : 'offline';
                // Only act on explicit focus/blur to prioritize connection lifecycle
                if (status === 'online') {
                    this.socket.emit('user-online');
                } else {
                    // Optional: delay offline emit to prevent flip-flopping
                    this.socket.emit('user-offline');
                }
            }
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

        // Close dropdowns & modals when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.chat-menu-wrapper')) {
                const menu = document.getElementById('chatDropdownMenu');
                if (menu) menu.style.display = 'none';
            }
            if (!e.target.closest('#pfpExpandModal')) {
                const modal = document.getElementById('pfpExpandModal');
                if (modal) modal.style.display = 'none';
            }
            if (!e.target.closest('#chatActionModal') && !e.target.closest('.conversation-card')) {
                const actionModal = document.getElementById('chatActionModal');
                if (actionModal) actionModal.style.display = 'none';
            }
        });

        // Scroll listener for "Scroll to Latest" button
        const container = document.getElementById('messagesContainer');
        container?.addEventListener('scroll', () => {
            const btn = document.getElementById('scrollToLatestBtn');
            if (btn) {
                const isFarUp = container.scrollHeight - container.scrollTop > 1000;
                btn.style.display = isFarUp ? 'flex' : 'none';
                if (!isFarUp) {
                    const badge = document.getElementById('newMsgBadge');
                    if (badge) badge.style.display = 'none';
                }
            }
        });

        // Swipe to reply
        const trackSwipe = { startX: 0, currentX: 0, el: null };
        if (container) {
            container.addEventListener('touchstart', e => {
                const bubble = e.target.closest('.msg-bubble');
                if (bubble) {
                    trackSwipe.el = bubble;
                    trackSwipe.startX = e.touches[0].clientX;
                }
            }, { passive: true });
            container.addEventListener('touchmove', e => {
                if (!trackSwipe.el) return;
                trackSwipe.currentX = e.touches[0].clientX;
                const diff = trackSwipe.currentX - trackSwipe.startX;
                if (diff > 10 && diff < 80) {
                    trackSwipe.el.style.transform = `translateX(${diff}px)`;
                    trackSwipe.el.style.transition = 'none';
                }
            }, { passive: true });
            container.addEventListener('touchend', e => {
                if (!trackSwipe.el) return;
                const diff = trackSwipe.currentX - trackSwipe.startX;
                trackSwipe.el.style.transition = 'transform 0.2s ease';
                trackSwipe.el.style.transform = `translateX(0px)`;
                if (diff > 50) {
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
            if (!this.isRecordingMedia) return; // Released too early or canceled
            this.voiceStream = stream;
            this.voiceChunks = [];
            this.mediaRecorder = new MediaRecorder(stream);
            this.mediaRecorder.ondataavailable = e => this.voiceChunks.push(e.data);
            this.mediaRecorder.onstop = () => {
                if (this.voiceCanceled) return;
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

            for (let i = 0; i < bars.length; i++) {
                bars[i].style.height = (Math.random() * 80 + 20) + '%';
            }

            const mins = Math.floor(this.voiceDuration / 60);
            const secs = this.voiceDuration % 60;
            if (timerUI) timerUI.innerText = `${mins}:${secs.toString().padStart(2, '0')}`;

            // 3 Minute Max Force Stop
            if (this.voiceDuration >= 180) {
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
        if (e) e.stopPropagation();
        if (!this.isRecordingMedia) return;
        this.isRecordingMedia = false;
        this.voiceCanceled = false;

        clearInterval(this.voiceTimerInterval);
        document.getElementById('voiceNoteOverlay').style.display = 'none';

        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        if (this.voiceStream) this.voiceStream.getTracks().forEach(track => track.stop());
    }

    cancelVoiceNote(e) {
        if (e) e.stopPropagation();
        if (!this.isRecordingMedia) return;
        this.isRecordingMedia = false;
        this.voiceCanceled = true;

        clearInterval(this.voiceTimerInterval);
        document.getElementById('voiceNoteOverlay').style.display = 'none';

        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        if (this.voiceStream) this.voiceStream.getTracks().forEach(track => track.stop());
    }

    handleMicClick() {
        // Now handled by startVoiceNote / stopVoiceNote through mousedown/mouseup
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = (Math.min(textarea.scrollHeight, 100)) + 'px';

        // Permanent Send: We no longer hide/show mic/send alternately, 
        // they are both available as requested. However, we can highlight Send when typing.
        const sendBtn = document.getElementById('sendBtn');
        if (textarea.value.trim().length > 0) {
            sendBtn.style.opacity = '1';
        } else {
            sendBtn.style.opacity = '0.6';
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
            } else if (this.currentTab === 'unread') {
                return c.unread_count > 0 && !c.is_archived;
            } else if (this.currentTab === 'groups') {
                return c.chat_type === 'group' && !c.is_archived;
            }
            return !c.is_archived;
        });

        if (filtered.length === 0) {
            list.innerHTML = `<div class="empty-state" style="text-align:center; padding:50px 20px; color:#8696a0;">No ${this.currentTab} chats yet</div>`;
            return;
        }

        list.innerHTML = filtered.map(conv => {
            const isOnline = conv.is_online;
            const unread = conv.unread_count > 0 ? `<span class="chat-unread">${conv.unread_count}</span>` : '';
            const activeClass = conv.chat_id === this.currentChatId ? 'active' : '';
            const isGroup = conv.chat_type === 'group';

            let lastMsg = conv.last_message || 'No messages yet';
            if (conv.last_message_type === 'image') lastMsg = '📷 Photo';
            if (conv.last_message_type === 'video') lastMsg = '🎥 Video';
            if (conv.last_message_type === 'voice_note') lastMsg = '🎙️ Voice Message';
            if (conv.last_message_type === 'marketplace_listing') lastMsg = '🛍️ Marketplace Item';

            let typingText = null;
            if (this.typingUsers && this.typingUsers[conv.chat_id]) {
                const typists = Array.from(this.typingUsers[conv.chat_id]);
                if (typists.length > 0) {
                    typingText = `<span style="color:#00a884; font-weight:500;">${typists.length > 2 ? typists.length + ' people' : typists.join(', ')} typing...</span>`;
                }
            }

            return `
                <div class="chat-item ${activeClass} ${conv.is_archived ? 'archived' : ''}" 
                     data-id="${conv.chat_id}"
                     onclick="window.sparkChat.openChat('${conv.chat_id}')"
                     onmousedown="window.sparkChat.startLongPress('${conv.chat_id}', event)"
                     onmouseup="window.sparkChat.endLongPress()"
                     onmouseleave="window.sparkChat.endLongPress()"
                     ontouchstart="window.sparkChat.startLongPress('${conv.chat_id}', event)"
                     ontouchend="window.sparkChat.endLongPress()">
                    
                    <img src="${conv.partner_avatar || '/uploads/avatars/default.png'}" class="chat-avatar" alt="${conv.partner_name}">

                    <div class="chat-details">
                        <div class="chat-top">
                            <span class="chat-name">
                                ${isGroup ? '<i class="bi bi-people-fill" style="margin-right:5px; font-size:13px; opacity:0.7;"></i>' : ''}
                                ${conv.partner_name}
                                ${conv.marketplace_listing_id ? '<i class="bi bi-shop-window" style="color:#00a884; font-size:12px; margin-left:5px;" title="From Marketplace"></i>' : ''}
                            </span>
                            <span class="chat-time" data-time="${conv.last_message_at}">${this.formatChatTime(conv.last_message_at)}</span>
                        </div>
                        <div class="chat-bottom" style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                            <span class="chat-message" data-original-message="${escape(lastMsg)}" style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#aaa; font-size:13px;">
                                ${typingText || lastMsg}
                            </span>
                            ${unread}
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
        if (confirm('Archive this chat?')) {
            const card = document.querySelector(`.conversation-card[data-id="${chatId}"]`);
            if (card) card.remove();
            alert('Chat archived.');
        }
    }

    async handleArchiveChat() {
        const chatId = this.currentChatId;
        if (!chatId) return;
        
        try {
            const response = await fetch(`/api/messages/chat/${chatId}/archive`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ archived: true })
            });
            const result = await response.json();
            
            if (result.status === 'success') {
                const conv = this.conversations.find(c => c.chat_id === chatId);
                if (conv) conv.is_archived = true;
                
                this.renderInbox();
                
                // Close chat view
                document.getElementById('chatMain').style.display = 'none';
                document.getElementById('chatEmptyWindow').style.display = 'flex';
                document.querySelector('.messaging-layout').classList.remove('chat-active');
            }
        } catch (err) {
            console.error('Archive failed:', err);
        }
    }

    async handleDeleteChat() {
        const chatId = this.currentChatId;
        if (!chatId || !confirm('Are you sure you want to delete this chat permanently?')) return;

        try {
            const response = await fetch(`/api/messages/chat/${chatId}`, { method: 'DELETE' });
            const result = await response.json();
            if (result.status === 'success') {
                this.conversations = this.conversations.filter(c => c.chat_id !== chatId);
                this.renderInbox();
                document.getElementById('chatMain').style.display = 'none';
                document.getElementById('chatEmptyWindow').style.display = 'flex';
                document.querySelector('.messaging-layout').classList.remove('chat-active');
            }
        } catch (err) {
            console.error('Delete failed:', err);
        }
    }

    async handleBlockUser() {
        const conv = this.conversations.find(c => c.chat_id === this.currentChatId);
        if (!conv || !conv.partner_id) return;

        if (!confirm(`Block ${conv.partner_name}? They will no longer be able to message you.`)) return;

        try {
            const response = await fetch(`/api/users/block/${conv.partner_id}`, { method: 'POST' });
            const result = await response.json();
            if (result.success) {
                alert('User blocked');
                window.location.reload(); // Hard refresh to clear state
            }
        } catch (err) {
            console.error('Block failed:', err);
        }
    }

    // --- Chat Logic ---

    async openChat(chatId) {
        if (this.currentChatId === chatId) return;

        this.currentChatId = chatId;
        document.querySelector('.messaging-layout').classList.add('chat-active');

        // Hide New Chat FAB when chat is open
        const fab = document.getElementById('waFabContainer');
        if (fab) fab.style.display = 'none';

        // Show input bar (in case it was hidden from a previous closeChat)
        const composer = document.querySelector('.chat-composer, footer.wa-composer');
        if (composer) composer.style.display = '';

        // Close any open modals from previous session
        this.closeAllModals();

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
        this.updateViewState('chat');
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
        // Async: inject OG link previews for any link-only messages
        this.injectLinkPreviews(messages);
    }

    // ── Link & Content Rendering Engine ──────────────────────────

    /** Turn raw URLs in a string into clickable <a> tags */
    linkify(text) {
        if (!text || typeof text !== 'string') return text || '';
        return text.replace(
            /(https?:\/\/[^\s<>"]+)/g,
            '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#53bdeb;text-decoration:underline;word-break:break-all;">$1</a>'
        );
    }

    /**
     * Render the text body of a message intelligently:
     *  - marketplace_inquiry JSON → already handled before this is called, so skip
     *  - media + link  → media shown above; text linkified below
     *  - link only      → linkified text + a placeholder div for the async OG preview
     *  - plain text     → linkified (links become clickable)
     */
    renderMsgBody(msg) {
        if (!msg.content) return '';

        // Skip: marketplace inquiry JSON is handled upstream
        if (msg.content.startsWith('{"type":"marketplace_inquiry"')) return '';

        const text = msg.content;
        const linkRe = /https?:\/\/[^\s<>"]+/g;
        const links = text.match(linkRe) || [];
        const hasMedia = !!msg.media_url;
        const msgId = msg.message_id || msg.id || (Date.now() + Math.random()).toString(36);

        // Pure link message (entire text is a single URL, no other words before/after)
        const isPureLink = links.length === 1 && text.trim() === links[0].trim();

        // Build the text part (always linkified)
        const bodyHtml = `<div class="msg-body" style="font-size:14px; white-space:pre-wrap; word-break:break-word;">${this.linkify(text)}</div>`;

        // For pure-link messages with no media, add an async preview placeholder
        if (isPureLink && !hasMedia && links.length > 0) {
            return bodyHtml + `<div id="lp-${msgId}" data-preview-url="${links[0]}" class="link-preview-slot"></div>`;
        }

        // For messages with multiple links or mixed content – just linkify
        // If it has media AND links, add a CTA button row at the bottom (like the prompt example)
        if (hasMedia && links.length > 0) {
            const btnHtml = links.map(link => `
                <a href="${link}" target="_blank" rel="noopener noreferrer" 
                   style="display:flex; align-items:center; justify-content:center; gap:6px; margin-top:8px; 
                          padding:8px; background:rgba(83,189,235,0.1); border-radius:10px; 
                          text-decoration:none; color:#53bdeb; font-size:12px; font-weight:700;">
                    <i class="bi bi-link-45deg"></i> Open Link
                </a>
            `).join('');
            return bodyHtml + `<div class="media-link-actions">${btnHtml}</div>`;
        }

        return bodyHtml;
    }

    /**
     * After rendering a batch of messages, find any link-preview placeholders
     * and asynchronously fetch + inject OG previews.
     */
    injectLinkPreviews(messages) {
        if (!messages || !Array.isArray(messages)) {
            // Single message path: scan the DOM for unfilled slots
            document.querySelectorAll('.link-preview-slot[data-preview-url]').forEach(slot => {
                if (!slot._previewFetched) {
                    slot._previewFetched = true;
                    this._fetchAndFillPreview(slot);
                }
            });
            return;
        }
        // Batch path: wait a tick so the DOM is populated first
        requestAnimationFrame(() => {
            document.querySelectorAll('.link-preview-slot[data-preview-url]').forEach(slot => {
                if (!slot._previewFetched) {
                    slot._previewFetched = true;
                    this._fetchAndFillPreview(slot);
                }
            });
        });
    }

    async _fetchAndFillPreview(slot) {
        const url = slot.dataset.previewUrl;
        if (!url) return;
        try {
            const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
            const data = await res.json();
            if (!data.success || (!data.title && !data.image)) return;

            // Determine if dark or light bubble context
            const bubble = slot.closest('.msg-sent, .msg-received');
            const isDark = bubble?.classList.contains('msg-sent');
            const bg = isDark ? '#1a1a2e' : '#fff';
            const textColor = isDark ? '#e0e0e0' : '#1a1a2e';
            const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';

            slot.innerHTML = `
                <div class="link-preview-card-wrapper" style="margin-top:8px;">
                    <a href="${url}" target="_blank" rel="noopener noreferrer" class="link-preview-card">
                        ${data.image ? `
                            <div class="preview-img-container">
                                <img src="${data.image}" onerror="this.parentElement.style.display='none'">
                            </div>` : ''}
                        <div class="preview-content">
                            ${data.title ? `<div class="preview-title" title="${data.title}">${data.title}</div>` : ''}
                            ${data.description ? `<div class="preview-description">${data.description}</div>` : ''}
                            <div class="preview-site-info">
                                <i class="bi bi-link-45deg"></i>
                                ${data.siteName || new URL(url).hostname.replace('www.','')}
                            </div>
                        </div>
                    </a>
                </div>`;
        } catch (e) { /* Fail silently — link stays clickable as text */ }
    }

    // ─────────────────────────────────────────────────────────────

    createMessageHTML(msg) {
        const isMe = String(msg.sender_id) === String(this.userId);
        const conv = this.conversations.find(c => String(c.chat_id) === String(this.currentChatId));
        const isGroup = conv?.chat_type === 'group';

        let statusIcon = 'bi-check';
        let statusColor = '#8696a0'; 
        
        if (msg.status === 'pending') {
            statusIcon = 'bi-clock';
        } else if (msg.status === 'delivered' || msg.delivered) {
            statusIcon = 'bi-check-all';
        } else if (msg.status === 'read' || msg.is_read) {
            statusIcon = 'bi-check-all';
            statusColor = '#53bdeb'; 
        }

        let mediaContent = '';
        const isLimited = msg.view_policy && msg.view_policy !== 'unlimited';

        if (msg.media_url) {
            if (isLimited && !isMe) {
                const limitIcon = msg.view_policy === 'once' ? 'bi-1-circle' : 'bi-2-circle';
                const limitText = msg.view_policy === 'once' ? 'Photo' : 'Photo (x2)';

                mediaContent = `
                    <div class="view-limited-placeholder" onclick="window.sparkChat.openLimitedMedia('${msg.message_id}', '${msg.media_url}', '${msg.type}')" 
                         style="background:#202c33; padding:15px; border-radius:12px; cursor:pointer; display:flex; align-items:center; color:#00a884; font-weight:600; border:1px solid #111b21;">
                        <i class="bi ${limitIcon}" style="font-size:20px; display:inline-block; margin-right:12px; opacity:0.8;"></i>
                        <span style="color:#e9edef;">${limitText}</span>
                    </div>
                `;
            } else if (isLimited && isMe) { 
                const limitIcon = msg.view_policy === 'once' ? 'bi-1-circle' : 'bi-2-circle';
                mediaContent = `
                    <div class="view-limited-placeholder" style="background:#005c4b; padding:15px; border-radius:12px; cursor:default; display:flex; align-items:center; color:#e9edef; font-weight:600; border:1px solid #111b21;">
                        <i class="bi ${limitIcon}" style="font-size:20px; display:inline-block; margin-right:12px; opacity:0.8;"></i>
                        <span style="color:#e9edef;">Photo</span>
                    </div>
                `;
            } else {
                if (msg.type === 'image' || msg.type === 'gif' || msg.type === 'sticker' || msg.media_url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
                    mediaContent = `<img src="${msg.media_url}" class="msg-media-img" loading="lazy" onclick="window.open('${msg.media_url}')" style="${msg.type === 'sticker' ? 'max-width:120px; background:transparent;' : 'max-width:80%;'} border-radius:12px;">`;
                } else if (msg.type === 'video' || msg.media_url.match(/\.(mp4|webm|mov)$/i)) {
                    mediaContent = `<video src="${msg.media_url}" class="msg-media-video" controls preload="none" style="max-width:80%; border-radius:12px; max-height:250px; background:#000;"></video>`;
                } else if (msg.type === 'audio' || msg.type === 'voice_note' || msg.media_url.match(/\.(mp3|wav|ogg|webm)$/i)) {
                    mediaContent = `
                        <div class="audio-bubble" style="display:flex; align-items:center; gap:12px; padding:8px 12px; background:rgba(0,0,0,0.1); border-radius:12px; min-width:220px;">
                            <div class="audio-play-btn" onclick="window.sparkChat.playAudio(this, '${msg.media_url}')" style="width:40px; height:40px; border-radius:50%; background:#00a884; display:flex; align-items:center; justify-content:center; color:white; cursor:pointer;">
                                <i class="bi bi-play-fill" style="font-size:24px;"></i>
                            </div>
                            <div class="audio-info" style="flex:1;">
                                <div class="audio-waveform" style="height:15px; background:rgba(255,255,255,0.1); border-radius:10px; position:relative; overflow:hidden;">
                                    <div class="audio-progress" style="position:absolute; top:0; left:0; height:100%; width:0%; background:#00a884; transition:width 0.1s linear;"></div>
                                </div>
                                <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:10px; color:#8696a0;">
                                    <span>VOICE NOTE</span>
                                    <span class="audio-duration">--:--</span>
                                </div>
                            </div>
                        </div>
                    `;
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

        // Rich Contact Card
        if (msg.type === 'contact') {
            let contactData = null;
            try {
                contactData = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
            } catch (e) { }

            if (contactData && contactData.userId) {
                return `
                    <div class="msg-bubble-wrapper ${isMe ? 'own-msg' : 'other-msg'}" style="display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; gap:2px; margin-bottom:12px;">
                        <div class="contact-card" onclick="window.location.href='/profile/${contactData.userId}'" style="display:flex; gap:10px; padding:15px; border-radius:12px; background:${isMe ? '#005c4b' : '#202c33'}; cursor:pointer; width:220px; align-items:center; transition: background 0.2s;">
                            <img src="${contactData.avatar}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                            <div style="flex:1;">
                                <div style="color:#e9edef; font-weight:600; font-size:15px; margin-top:-2px;">${contactData.username}</div>
                                <div style="color:#8696a0; font-size:12px;">Tap to view profile</div>
                            </div>
                            <i class="bi bi-person-fill" style="color:#8696a0; font-size:20px;"></i>
                        </div>
                        <div class="msg-footer" style="display:flex; align-items:center; justify-content:flex-end; gap:4px; font-size:11px; color:#8696a0;">
                            <span>${this.formatTime(msg.sent_at)}</span>
                            ${isMe ? `
                                <span class="msg-tick">
                                    <i class="bi ${msg.is_read || msg.status === 'read' ? 'bi-check-all' : (msg.delivered ? 'bi-check-all' : 'bi-check')}"
                                       style="color:${msg.is_read || msg.status === 'read' ? '#53bdeb' : '#8696a0'}; font-size:16px;"></i>
                                </span>` : ''}
                        </div>
                    </div>
                `;
            }
        }

        // Location Map Preview
        if (msg.type === 'location') {
            let locData = null;
            try {
                locData = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
            } catch (e) { }

            if (locData && locData.lat !== undefined && locData.lng !== undefined) {
                const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${locData.lat},${locData.lng}&zoom=15&size=300x200&maptype=roadmap&markers=color:red%7C${locData.lat},${locData.lng}&key=YOUR_ACTUAL_API_KEY_HERE`;
                const gmapsLink = `https://www.google.com/maps/search/?api=1&query=${locData.lat},${locData.lng}`;
                return `
                    <div class="msg-bubble-wrapper ${isMe ? 'own-msg' : 'other-msg'}" style="display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; gap:2px; margin-bottom:12px;">
                        <div class="location-card" onclick="window.open('${gmapsLink}')" style="border-radius:12px; overflow:hidden; background:${isMe ? '#005c4b' : '#202c33'}; cursor:pointer; width:260px; border:1px solid rgba(255,255,255,0.1);">
                            <div style="width:100%; height:150px; background:#111; display:flex; align-items:center; justify-content:center; color:#8696a0;">
                                <i class="bi bi-map-fill" style="font-size:32px; color:#53bdeb; margin-right:10px;"></i> Location preview
                            </div>
                            <div style="padding:10px; display:flex; align-items:center;">
                                <div style="flex:1;">
                                    <div style="color:#e9edef; font-weight:600; font-size:14px;">Live Location</div>
                                    <div style="color:#8696a0; font-size:12px;">Tap to view in Maps</div>
                                </div>
                                <i class="bi bi-geo-alt-fill" style="color:#00a884; font-size:20px;"></i>
                            </div>
                        </div>
                        <div class="msg-footer" style="display:flex; align-items:center; justify-content:flex-end; gap:4px; font-size:11px; color:#8696a0;">
                            <span>${this.formatTime(msg.sent_at)}</span>
                            ${isMe ? `
                                <span class="msg-tick">
                                    <i class="bi ${msg.is_read || msg.status === 'read' ? 'bi-check-all' : (msg.delivered ? 'bi-check-all' : 'bi-check')}"
                                       style="color:${msg.is_read || msg.status === 'read' ? '#53bdeb' : '#8696a0'}; font-size:16px;"></i>
                                </span>` : ''}
                        </div>
                    </div>
                `;
            }
        }

        let reactionsHtml = '';
        if (msg.reactions && msg.reactions.length > 0) {
            // Deduplicate emojis and count
            const reactionCounts = {};
            let reactionsArray = msg.reactions;
            if (typeof reactionsArray === 'string') {
                try { reactionsArray = JSON.parse(reactionsArray); } catch (e) { }
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

        // Marketplace Listing Card (from product detail page links)
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

        // Rich Marketplace Inquiry Card (from "Is this still available?" CTA)
        // Check msg.type OR detect from content JSON (fallback for DBs with strict ENUM)
        const isMarketplaceCard = msg.type === 'marketplace_inquiry' ||
            (typeof msg.content === 'string' && msg.content.startsWith('{"type":"marketplace_inquiry"'));

        if (isMarketplaceCard) {
            let mktData = null;
            try {
                const parsed = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
                if (parsed && parsed.type === 'marketplace_inquiry') mktData = parsed.payload;
            } catch (e) {}

            if (mktData) {
                const isMe = msg.sender_id === this.userId;
                return `
                    <div class="msg-bubble-wrapper ${isMe ? 'own-msg' : 'other-msg'}" style="display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; gap:2px; margin-bottom:12px;">
                        <div class="mkt-inquiry-card" onclick="window.open('${mktData.link}', '_blank')" style="cursor:pointer; width:260px; border-radius:16px; overflow:hidden; background:${isMe ? '#1a1a2e' : '#fff'}; box-shadow:0 4px 20px rgba(0,0,0,0.18); border:1px solid ${isMe ? 'rgba(255,77,166,0.3)' : 'rgba(0,0,0,0.08)'}; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                            <div style="position:relative; width:100%; height:180px; overflow:hidden; background:#111;">
                                <img src="${mktData.image || '/images/default-listing.jpg'}" alt="${mktData.title || 'Item'}" onerror="this.src='/images/default-listing.jpg'" style="width:100%; height:100%; object-fit:cover; display:block;">
                                <div style="position:absolute; top:10px; left:10px; background:rgba(255,77,166,0.9); color:#fff; font-size:10px; font-weight:800; padding:3px 9px; border-radius:20px; letter-spacing:0.5px;">MARKETPLACE</div>
                            </div>
                            <div style="padding:12px 14px 14px;">
                                <div style="font-size:18px; font-weight:800; color:${isMe ? '#ff4da6' : '#ff4da6'}; margin-bottom:4px;">💰 ${mktData.price || 'Contact seller'}</div>
                                <div style="font-size:13px; font-weight:600; color:${isMe ? '#e0e0e0' : '#1a1a2e'}; line-height:1.4; margin-bottom:10px;">${mktData.title || 'Marketplace Item'}</div>
                                <div style="display:flex; align-items:center; gap:6px; background:${isMe ? 'rgba(255,77,166,0.15)' : 'rgba(255,77,166,0.08)'}; border-radius:8px; padding:8px 10px;">
                                    <i class="bi bi-shop" style="color:#ff4da6; font-size:14px;"></i>
                                    <span style="font-size:12px; font-weight:700; color:#ff4da6;">View Listing →</span>
                                </div>
                            </div>
                        </div>
                        <div style="font-size:10px; color:#8696a0; padding: 0 4px; margin-top:2px;">Is this still available?</div>
                        <div class="msg-footer" style="display:flex; align-items:center; justify-content:flex-end; gap:4px; font-size:11px; color:#8696a0;">
                            <span>${this.formatTime(msg.sent_at)}</span>
                            ${isMe ? `
                                <span class="msg-tick">
                                    <i class="bi ${msg.is_read || msg.status === 'read' ? 'bi-check-all' : (msg.delivered ? 'bi-check-all' : 'bi-check')}"
                                       style="color:${msg.is_read || msg.status === 'read' ? '#53bdeb' : '#8696a0'}; font-size:16px;"></i>
                                </span>` : ''}
                        </div>
                    </div>
                `;
            }
        }

        if (msg.type === 'system') {
            let displayContent = msg.content;
            
            // Handle Structured Admin Notifications
            if (msg.content.startsWith('PROMOTED_TO_ADMIN:')) {
                const [_, targetId, username] = msg.content.split(':');
                if (targetId === this.userId) {
                    displayContent = `<span style="font-weight:700; color:#00a884;"><i class="bi bi-patch-check-fill"></i> You are now an Admin!</span>`;
                } else {
                    displayContent = `<i class="bi bi-shield-check"></i> Admin promoted @${username} to Admin`;
                }
            } else if (msg.content.startsWith('DEMOTED_TO_MEMBER:')) {
                const [_, targetId, username] = msg.content.split(':');
                if (targetId === this.userId) {
                    displayContent = `<span style="color:#ef4444;">Your Admin privileges were removed.</span>`;
                } else {
                    displayContent = `Admin demoted @${username} to member`;
                }
            } else if (msg.content.startsWith('REMOVED_FROM_GROUP:')) {
                const [_, targetId, username] = msg.content.split(':');
                if (targetId === this.userId) {
                    displayContent = `<span style="color:#ef4444;">You were removed from the group.</span>`;
                } else {
                    displayContent = `Admin removed @${username} from the group`;
                }
            }

            return `<div class="msg-bubble msg-system" data-msg-id="${msg.message_id}">
                ${displayContent}
            </div>`;
        }

        // Point 2: Stable Timestamps
        const timestamp = msg.sent_at || msg.created_at;
        const displayTime = this.formatTime(timestamp);
        
        return `
            <div class="msg-bubble-wrapper ${isMe ? 'own-msg' : 'other-msg'}" style="display:flex; flex-direction:column; align-items: ${isMe ? 'flex-end' : 'flex-start'}; gap:2px; margin-bottom:8px;">
                ${isGroup && !isMe && !isDeleted ? `
                    <div class="sender-info" style="display:flex; align-items:center; gap:6px; margin-bottom:2px; padding-left:12px;">
                        <img src="${msg.sender_avatar || '/uploads/avatars/default.png'}" style="width:18px; height:18px; border-radius:50%; object-fit:cover;">
                        <span style="font-size:11px; font-weight:700; color:#53bdeb; cursor:pointer;" onclick="window.location.href='/profile/${msg.sender_id}'">${msg.sender_name}</span>
                    </div>
                ` : ''}
                <div class="msg-bubble ${isMe ? 'msg-sent' : 'msg-received'} ${isDeleted ? 'msg-deleted' : ''}" data-msg-id="${msg.message_id}" data-is-own="${isMe}">
                    ${msg.reply_to_message_id && !isDeleted ? `
                        <div class="reply-preview">
                            <i class="bi bi-reply-fill"></i>
                            <span>${msg.reply_content}</span>
                        </div>
                    ` : ''}
                    ${!isDeleted ? mediaContent : ''}
                    ${listingHtml && !isDeleted ? listingHtml : ''}
                    ${isDeleted ? '<div class="msg-body" style="font-size:14px;">\uD83D\uDEAB This message was deleted.</div>' : this.renderMsgBody(msg)}
                    <div class="msg-footer" style="display:flex; align-items:center; justify-content:flex-end; gap:4px; font-size:11px; color:#8696a0; margin-top:2px;">
                        <span>${displayTime}</span>
                        ${msg.edited_at && !isDeleted ? '<span style="font-style:italic;">(edited)</span>' : ''}
                        ${isMe && !isDeleted ? `
                            <span class="msg-tick">
                                <i class="bi ${statusIcon}" 
                                   style="color:${statusColor}; font-size:16px; margin-left:2px;"></i>
                            </span>
                        ` : ''}
                    </div>
                    ${reactionsHtml}
                </div>
            </div>
        `;
    }

    updateChatHeader(chatId) {
        const conv = this.conversations.find(c => c.chat_id === chatId);
        if (!conv) return;

        const headerBanner = document.getElementById('chatBanner');
        if (headerBanner) {
            headerBanner.style.cursor = 'pointer';
            headerBanner.onclick = () => this.openGroupInfo();
        }

        document.getElementById('bannerAvatar').src = conv.partner_avatar || '/uploads/avatars/default.png';
        document.getElementById('bannerName').textContent = conv.partner_name;

        const statusEl = document.getElementById('bannerStatus');
        if (conv.chat_type === 'group') {
            statusEl.textContent = (conv.member_count || 'Several') + ' members';
        } else {
            statusEl.textContent = this.formatLastSeen(conv.last_seen_at, conv.is_online);
            statusEl.style.color = conv.is_online ? '#00a884' : '#888';
        }

        // Apply disappearing messages UI if active
        const notice = document.getElementById('disappearingNotice');
        if (conv.disappearing_duration > 0) {
            document.getElementById('chatComposer').classList.add('disappearing-active');
            if (notice) notice.style.display = 'block';
        } else {
            document.getElementById('chatComposer').classList.remove('disappearing-active');
            if (notice) notice.style.display = 'none';
        }

        // --- Admin Restrictions ---
        const input = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const mediaBtn = document.querySelector('.bi-image');
        const editBtn = document.getElementById('menuGroupSettings'); // Check if this is the edit button
        
        const amIAdmin = conv.role === 'admin' || conv.role === 'creator';
        
        // Block text/media if group is "Only Admins"
        if (conv.chat_type === 'group' && conv.only_admins_send === 1 && !amIAdmin) {
            if (input) {
                input.disabled = true;
                input.placeholder = "Only admins can send messages";
            }
            if (sendBtn) sendBtn.style.opacity = '0.3';
            if (mediaBtn) mediaBtn.style.pointerEvents = 'none';
        } else {
            if (input) {
                input.disabled = false;
                input.placeholder = "Type a message...";
            }
            if (sendBtn) sendBtn.style.opacity = '1';
            if (mediaBtn) mediaBtn.style.pointerEvents = 'all';
        }

        // Hide/Show "Edit Info" (Group Settings)
        if (conv.chat_type === 'group') {
            const canEdit = conv.edit_info === 'members' || amIAdmin;
            if (editBtn) editBtn.style.display = canEdit ? 'block' : 'none';
        }

        // Sync bio
        const settingsBio = document.getElementById('settingsStatus');
        if (settingsBio) {
            settingsBio.textContent = conv.bio || "Hey there! I am using Sparkle.";
            settingsBio.style.cursor = 'pointer';
            settingsBio.onclick = () => this.editBio(conv.bio);
        }
    }

    async editBio(currentBio) {
        const newBio = prompt("Edit your about info:", currentBio || "");
        if (newBio !== null) {
            try {
                const res = await fetch('/api/users/profile', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bio: newBio })
                });
                const result = await res.json();
                if (result.status === 'success') {
                    // Update locally
                    const conv = this.conversations.find(c => c.chat_id === this.currentChatId);
                    if (conv) conv.bio = newBio;
                    this.updateChatHeader(this.currentChatId);
                }
            } catch (err) {
                console.error("Failed to update bio:", err);
            }
        }
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
        if (viewPolicyLabel) viewPolicyLabel.innerText = 'Keep';
        if (viewPolicyIcon) viewPolicyIcon.className = 'bi bi-infinity';

        if (type === 'image') {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewContent.innerHTML = `<img src="${e.target.result}" style="max-width:100%; max-height:80vh; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.1);">`;
                previewModal.style.display = 'flex';
            };
            reader.readAsDataURL(file);
        } else if (type === 'video') {
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

        if (this.pendingViewPolicy === 'unlimited') {
            this.pendingViewPolicy = 'once';
            if (vpLabel) vpLabel.innerText = 'View Once';
            vpIcon.className = 'bi bi-1-circle';
        } else if (this.pendingViewPolicy === 'once') {
            this.pendingViewPolicy = 'twice';
            if (vpLabel) vpLabel.innerText = 'View Twice';
            vpIcon.className = 'bi bi-2-circle';
        } else {
            this.pendingViewPolicy = 'unlimited';
            if (vpLabel) vpLabel.innerText = 'Keep';
            vpIcon.className = 'bi bi-infinity';
        }
    }

    async confirmSendMedia() {
        if (!this.pendingMediaParams || !this.currentChatId) return;

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

        const conv = this.conversations.find(c => String(c.chat_id) === String(this.currentChatId));
        const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        const data = {
            chatId: this.currentChatId,
            recipientId: conv?.partner_id,
            content: content,
            type: 'text',
            tempId: tempId,
            replyToId: this.replyingToMessageId,
            marketplaceListingId: conv?.marketplace_listing_id
        };

        // 1. Optimistic UI: Render immediately as pending
        const msgObj = {
            ...data,
            message_id: tempId,
            sender_id: this.userId,
            status: 'pending',
            sent_at: new Date().toISOString()
        };
        
        const container = document.getElementById('messagesContainer');
        if (container) {
            container.insertAdjacentHTML('beforeend', this.createMessageHTML(msgObj));
            this.scrollToBottom(true);
        }

        // 2. Reliable Delivery: Emit with acknowledgment
        this._safeEmit('send-message', data, (ack) => {
            if (ack && ack.success) {
                // Update specific bubble to reflect success
                const bubble = document.querySelector(`[data-msg-id="${tempId}"]`);
                if (bubble) {
                    bubble.dataset.msgId = ack.messageId;
                    const tickIcon = bubble.querySelector('.msg-tick i');
                    if (tickIcon) {
                        tickIcon.className = 'bi bi-check';
                    }
                }
                // Add real ID to rendered set
                if (!this._renderedIds) this._renderedIds = new Set();
                this._renderedIds.add(ack.messageId);
            } else {
                // Mark as failed
                const bubble = document.querySelector(`[data-msg-id="${tempId}"]`);
                if (bubble) {
                    const tickIcon = bubble.querySelector('.msg-tick i');
                    if (tickIcon) {
                        tickIcon.className = 'bi bi-exclamation-circle';
                        tickIcon.style.color = '#ef4444';
                    }
                }
            }
        });

        input.value = '';
        this.autoResizeTextarea(input);
        this.stopTyping();
        this.cancelReplyOrEdit();
    }

    toggleEmojiPicker(e, startTab) {
        if (e && e.stopPropagation) e.stopPropagation();
        const picker = document.getElementById('emojiPickerPanel');
        if (!picker) return;
        
        const isCurrentlyVisible = (picker.style.display === 'flex' || window.getComputedStyle(picker).display === 'flex');
        const targetTab = startTab || this._currentPickerTab || 'emoji';

        console.log(`⚡ Picker Toggle: visible=${isCurrentlyVisible}, target=${targetTab}, current=${this._currentPickerTab}`);

        if (isCurrentlyVisible && (!startTab || this._currentPickerTab === targetTab)) {
            this.closeEmojiPicker();
        } else {
            picker.style.display = 'flex';
            this.switchPickerTab(targetTab);
        }
    }

    closeEmojiPicker() {
        const picker = document.getElementById('emojiPickerPanel');
        if (picker) {
            picker.style.display = 'none';
        }
    }

    // Legacy alias
    initEmojiMart() { this.switchPickerTab('emoji'); }

    insertEmoji(emoji) {
        const input = document.getElementById('messageInput');
        const start = input.selectionStart || input.value.length;
        const end = input.selectionEnd || input.value.length;
        const text = input.value;
        input.value = text.substring(0, start) + emoji + text.substring(end);
        input.selectionStart = input.selectionEnd = start + emoji.length;
        this.autoResizeTextarea(input);
        input.focus();
    }

    handleIncomingMessage(msg) {
        const messageId = msg.message_id || msg.id;
        if (!messageId) return;

        const isSelf = String(msg.sender_id) === String(this.userId);
        
        // 1. DEDUPLICATION: Prevent duplicate renders/sounds
        if (this._renderedIds?.has(messageId)) return;
        if (document.querySelector(`.msg-bubble[data-msg-id="${messageId}"]`)) return;
        
        // Also check if this is a message we sent optimistically that hasn't been "acked" yet
        if (isSelf && msg.content) {
            const allBubbles = document.querySelectorAll('.msg-sent');
            for (let b of allBubbles) {
                if (b.dataset.msgId?.startsWith('temp-') && b.querySelector('.msg-body')?.textContent?.trim() === (msg.content || '').trim()) {
                    // This is our pending message! Update its ID and status.
                    b.dataset.msgId = messageId;
                    const tick = b.querySelector('.msg-tick i');
                    if (tick) tick.className = 'bi bi-check';
                    if (!this._renderedIds) this._renderedIds = new Set();
                    this._renderedIds.add(messageId);
                    return; 
                }
            }
        }

        const msgChatId = msg.conversation_id || msg.chat_id;
        
        // 2. RENDER: Show in active chat if it matches
        if (this.currentChatId === msgChatId) {
            const container = document.getElementById('messagesContainer');
            if (container) {
                container.insertAdjacentHTML('beforeend', this.createMessageHTML(msg));
                this.scrollToBottom(false);
                this.injectLinkPreviews(msg);
            }

            this.socket.emit('mark-delivered', { messageId: messageId, chatId: msgChatId });
            this.socket.emit('mark-read', this.currentChatId);
        }

        // 3. SOUND LOGIC: Strictly for incoming messages from OTHERS
        if (!isSelf) {
            const isWindowFocused = document.visibilityState === 'visible';
            const isChatActive = this.currentChatId === msgChatId;

            // Only play sound if chat is hidden, or if in another chat, or if window is backgrounded
            if (!isWindowFocused || !isChatActive) {
                this.playNotificationSound();
            }
        }

        // 4. INDEX UPDATE: Ensure inbox preview stays fresh
        this.updateInboxPreview(msg);

        // 5. STATE: Track ID to prevent duplicates
        if (!this._renderedIds) this._renderedIds = new Set();
        this._renderedIds.add(messageId);
        
        // Safety cap for state memory
        if (this._renderedIds.size > 200) {
            const first = this._renderedIds.values().next().value;
            this._renderedIds.delete(first);
        }
    }

    handleMessageSent(msg) {
        const messageId = msg.message_id || msg.id;
        if (!messageId) return;

        // 1. DEDUPLICATION (Optimistic UI check)
        if (this._renderedIds?.has(messageId)) return;
        
        // Check for tempId bubble from createMessageHTML
        const existing = document.querySelector(`.msg-bubble[data-msg-id="${messageId}"]`);
        if (existing) {
             if (!this._renderedIds) this._renderedIds = new Set();
             this._renderedIds.add(messageId);
             return;
        }

        // Check for ANY temp bubble that might match
        const allBubbles = document.querySelectorAll('.msg-sent');
        for (let b of allBubbles) {
            if (b.dataset.msgId?.startsWith('temp-') && b.querySelector('.msg-body')?.textContent?.trim() === (msg.content || '').trim()) {
                b.dataset.msgId = messageId;
                const tick = b.querySelector('.msg-tick i');
                if (tick) tick.className = 'bi bi-check';
                if (!this._renderedIds) this._renderedIds = new Set();
                this._renderedIds.add(messageId);
                return;
            }
        }

        // 2. RENDER (if not already there)
        if (messageId) {
            if (!this._renderedIds) this._renderedIds = new Set();
            this._renderedIds.add(messageId);
        }
        
        const container = document.getElementById('messagesContainer');
        if (container) {
            container.insertAdjacentHTML('beforeend', this.createMessageHTML(msg));
            this.scrollToBottom(true);
        }
        this.updateInboxPreview(msg);
        this.injectLinkPreviews(msg);
    }

    updateInboxPreview(message) {
        const msgChatId = message.conversation_id || message.chat_id;
        const convIndex = this.conversations.findIndex(c => String(c.chat_id) === String(msgChatId));

        if (convIndex > -1) {
            const conv = this.conversations[convIndex];
            conv.last_message = message.content;
            conv.last_message_type = message.type;
            conv.last_message_at = message.sent_at;

            if (this.currentChatId !== msgChatId) {
                conv.unread_count = (conv.unread_count || 0) + 1;
            }

            // Move to top
            this.conversations.splice(convIndex, 1);
            this.conversations.unshift(conv);
            this.renderInbox();
        } else {
            // New conversation starter or just reload
            this.loadInbox();
        }
    }

    playNotificationSound() {
        if (window.NotificationManager) {
            // Default behavior provided in requirements
            window.NotificationManager.play("default");
        } else {
            console.warn('🔊 Sparkle: NotificationManager not found, skipping sound');
        }
    }

    // --- Presence & Status ---

    handleUserStatus(data) {
        // 1. Update global conversations list statuses
        const conv = this.conversations.find(c => c.partner_id === data.userId && c.chat_type !== 'group');
        if (conv) {
            conv.is_online = data.isOnline;
            conv.last_seen_at = data.lastSeen;
            // Only update header if this is the active conversation partner
            if (this.currentChatId === conv.chat_id) {
                this.updateChatHeader(conv.chat_id);
            }
        }

        // 2. Update Group Member status if drawer is open
        const groupInfoDrawer = document.getElementById('groupInfoDrawer');
        if (groupInfoDrawer && groupInfoDrawer.style.display !== 'none') {
            const memberRow = document.querySelector(`.user-search-result[onclick*="'${data.userId}'"]`);
            if (memberRow) {
                const statusLabel = memberRow.querySelector('div[style*="color:#888"]');
                if (statusLabel) {
                    statusLabel.innerHTML = data.isOnline ? '<span style="color:#00a884;">online</span>' : 'offline';
                }
            }
        }

        // 3. Update active friends carousel
        this.renderActiveFriends();
    }

    handleReadReceipt(data) {
        const { chatId, messageId } = data;
        if (this.currentChatId === chatId) {
            const selector = messageId ? `.msg-bubble[data-msg-id="${messageId}"] .msg-tick i` : '.msg-sent .msg-tick i';
            document.querySelectorAll(selector).forEach(tick => {
                tick.className = 'bi bi-check-all';
                tick.style.color = '#53bdeb'; // Double Blue Tick
            });
        }
    }

    handleMessageDelivered(data) {
        const { chatId, messageId } = data;
        if (this.currentChatId === chatId) {
            const selector = messageId ? `.msg-bubble[data-msg-id="${messageId}"] .msg-tick i` : '.msg-sent .msg-tick i';
            document.querySelectorAll(selector).forEach(tick => {
                if (tick.style.color !== '#53bdeb') { // Don't downgrade from blue
                    tick.className = 'bi bi-check-all';
                    tick.style.color = '#8696a0'; // Double Grey Tick
                }
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
        this.typingTimeout = setTimeout(() => this.stopTyping(), 3000);
    }

    stopTyping() {
        this.isTyping = false;
        this.socket.emit('typing', { chatId: this.currentChatId, isTyping: false });
    }

    handleTypingIndicator(data) {
        const { chatId, isTyping, username } = data;

        if (!this.typingUsers[chatId]) this.typingUsers[chatId] = new Set();
        if (isTyping) {
            this.typingUsers[chatId].add(username);
            // Setup timeout to clear ghost typing indicators (e.g. if close event lost)
            // We use a custom property on the Set or manage timeouts externally. 
            // Simple: Just let it be for now or handle via client timeouts locally.
            // Let's implement auto-clear using an object wrapper down the line, but set timeout here:
            if (this.typingUsers[chatId]._timeout) clearTimeout(this.typingUsers[chatId]._timeout);
            this.typingUsers[chatId]._timeout = setTimeout(() => {
                if (this.typingUsers[chatId]) this.typingUsers[chatId].delete(username);
                this.updateSidebarTypingState(chatId);
            }, 6000);
        } else {
            this.typingUsers[chatId].delete(username);
        }

        // Always update side preview immediately
        this.updateSidebarTypingState(chatId);

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
            // Auto-remove after 4s as fallback
            if (this.typingPillTimeout) clearTimeout(this.typingPillTimeout);
            this.typingPillTimeout = setTimeout(() => {
                document.getElementById('typingIndicator')?.remove();
            }, 4000);
        } else {
            pill?.remove();
            if (this.typingUsers[chatId] && this.typingUsers[chatId].size > 0) {
                // If others are still typing, we may want to recreate the pill. For now just removing is okay.
                // We'll trust the next emit to recreate it.
            }
        }
    }

    updateSidebarTypingState(chatId) {
        const item = document.querySelector(`.chat-item[data-id="${chatId}"]`);
        if (!item) return;

        const msgSpan = item.querySelector('.chat-message');
        if (!msgSpan) return;

        const typists = Array.from(this.typingUsers[chatId] || []);
        if (typists.length > 0) {
            const txt = typists.length > 2 ? typists.length + ' people' : typists.join(', ');
            msgSpan.innerHTML = `<span style="color:#00a884; font-weight:500;">${txt} typing...</span>`;
        } else {
            // Restore original message
            msgSpan.innerHTML = unescape(msgSpan.getAttribute('data-original-message') || '');
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
    // UNIFIED PICKER: switchPickerTab + GIPHY
    // ==========================================
    get GIPHY_KEY() { return this._giphyApiKey; }

    switchPickerTab(tab) {
        console.log(`⚡ Picker: Attempting switch to [${tab}]`);
        this._currentPickerTab = tab;
        
        try {
            // ── Tab button active states ──────────────────────────────
            const tabKeys = ['emoji','gif','sticker'];
            tabKeys.forEach(t => {
                const btnId = `tabBtn${t.charAt(0).toUpperCase()+t.slice(1)}`;
                const btn = document.getElementById(btnId);
                if (!btn) {
                    console.warn(`⚠️ Picker: Button #${btnId} not found`);
                    return;
                }
                if (t === tab) {
                    btn.style.color = '#00a884';
                    btn.style.borderBottomColor = '#00a884';
                    btn.style.opacity = '1';
                    btn.classList.add('active');
                } else {
                    btn.style.color = '#8696a0';
                    btn.style.borderBottomColor = 'transparent';
                    btn.style.opacity = '0.6';
                    btn.classList.remove('active');
                }
            });

            // ── Show/hide tab panels with absolute switch ─────────────
            const panels = {
                emoji: document.getElementById('pickerTabEmoji'),
                gif: document.getElementById('pickerTabGif'),
                sticker: document.getElementById('pickerTabSticker')
            };

            Object.entries(panels).forEach(([type, el]) => {
                if (el) {
                    const shouldShow = (type === tab);
                    el.style.setProperty('display', shouldShow ? 'flex' : 'none', 'important');
                    console.log(`⚡ Picker: Panel [${type}] display set to ${shouldShow ? 'flex' : 'none'}`);
                }
            });

            // ── Trigger specific loader ──────────────────────────────
            if (tab === 'emoji') {
                 this._initEmojiMartPicker();
            } else if (tab === 'gif') {
                this._loadGiphyContent('gif');
            } else if (tab === 'sticker') {
                this._loadGiphyContent('sticker');
            }
        } catch (err) {
            console.error('❌ Picker Switch Error:', err);
        }
    }

    // ── LEGACY compatibility ────
    switchEmojiTab(tab) { this.switchPickerTab(tab === 'recent' ? 'emoji' : tab); }
    renderEmojiGrid(q)  { /* Handled by EmojiMart */ }
    renderGifGrid(q)    { this._loadTenorContent('gif', q); }
    renderStickerGrid() { this._loadTenorContent('sticker'); }

    // ── EMOJI: Mount EmojiMart web component (3600+ emojis) ──────
    _initEmojiMartPicker() {
        const mount = document.getElementById('emojiMartMount');
        if (!mount) return;
        if (mount.dataset.initialized === 'true') return; // Already setup

        const tryMount = () => {
            if (!window.EmojiMart) {
                console.warn('⚡ Picker: Waiting for EmojiMart scripts...');
                mount.innerHTML = '<div style="color:#8696a0;padding:20px;text-align:center;">Loading Emojis...</div>';
                setTimeout(tryMount, 800);
                return;
            }
            
            mount.innerHTML = '';
            try {
                const picker = new window.EmojiMart.Picker({
                    theme: 'dark',
                    set: 'native',
                    previewPosition: 'none',
                    skinTonePosition: 'search',
                    onEmojiSelect: (emoji) => {
                        this.insertEmoji(emoji.native);
                        // Save to recents handled by Picker itself usually, but we keep our local logic
                        this.saveRecentEmoji(emoji.native);
                    },
                    style: { height: '100%', width: '100%' }
                });
                mount.appendChild(picker);
                mount.dataset.initialized = 'true';
                console.log('✅ Picker: EmojiMart successfully mounted.');
            } catch (err) {
                console.error('⚡ Picker: Failed to mount EmojiMart:', err);
                mount.innerHTML = '<div style="color:#ef4444;padding:20px;text-align:center;">Failed to load emojis</div>';
            }
        };
        tryMount();
    }

    // ── GIPHY: GIFs and Stickers ─────────────────────────────
    async _loadGiphyContent(type, query) {
        const gridId = type === 'gif' ? 'gifResultsGrid' : 'stickerResultsGrid';
        const grid = document.getElementById(gridId);
        if (!grid) return;
        
        // Local loading UI
        if (!grid.hasChildNodes() || query) {
            grid.innerHTML = `<div class="chat-loader" style="grid-column:1/-1; padding:30px;"><div class="spinner-pink"></div></div>`;
        }
        
        try {
            const q = query && query.trim() ? query.trim() : null;
            const isSticker = (type === 'sticker');
            const searchEndpoint = `https://api.giphy.com/v1/${isSticker?'stickers':'gifs'}/search?api_key=${this.GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=30&rating=g`;
            const trendingEndpoint = `https://api.giphy.com/v1/${isSticker?'stickers':'gifs'}/trending?api_key=${this.GIPHY_KEY}&limit=30&rating=g`;
            
            const res = await fetch(q ? searchEndpoint : trendingEndpoint);
            const data = await res.json();
            
            if (!data.data || data.data.length === 0) {
                grid.innerHTML = `<div style="color:#8696a0;padding:20px;text-align:center;grid-column:1/-1;">No results for "${q}"</div>`;
                return;
            }
            
            grid.innerHTML = data.data.map(item => {
                const low = item.images.fixed_height_small.url;
                const high = item.images.fixed_height.url;
                
                // Hardened styling to prevent overlap
                const itemStyles = `
                    position: relative; 
                    background: #111b21; 
                    border-radius: 8px; 
                    overflow: hidden; 
                    width: 100%;
                    height: ${isSticker ? '100px' : '90px'};
                    display: block;
                `;
                
                return `<div class="media-item-wrapper" style="${itemStyles}">
                    <img src="${low}" loading="lazy"
                         style="width:100%; height:100%; object-fit:${isSticker?'contain':'cover'}; cursor:pointer; touch-action:manipulation; display:block;"
                         onclick="window.sparkChat.${isSticker?'sendSticker':'sendGif'}('${high}')"
                         onerror="this.src='/img/floral.png'">
                </div>`;
            }).join('');
        } catch(err) {
            console.error('❌ GIPHY Error:', err);
            grid.innerHTML = `<div style="color:#ef4444;padding:20px;text-align:center;grid-column:1/-1;">GIPHY Connection Error</div>`;
        }
    }

    searchGiphy(query) {
        clearTimeout(this._gifSearchTimer);
        this._gifSearchTimer = setTimeout(() => this._loadGiphyContent('gif', query), 500);
    }

    searchGiphyStickers(query) {
        clearTimeout(this._stickerSearchTimer);
        this._stickerSearchTimer = setTimeout(() => this._loadGiphyContent('sticker', query), 500);
    }

    renderAvatarGrid() { /* Legacy no-op */ }



    sendGif(url) {
        this.socket.emit('send-message', {
            chatId: this.currentChatId,
            recipientId: this.conversations.find(c => c.chat_id == this.currentChatId)?.partner_id,
            content: '',
            mediaUrl: url,
            type: 'gif',
        });
        const pickerPanel = document.getElementById('emojiPickerPanel');
        if (pickerPanel) pickerPanel.style.display = 'none';
        this.closeAllModals();
    }

    sendSticker(url) {
        this.socket.emit('send-message', {
            chatId: this.currentChatId,
            recipientId: this.conversations.find(c => c.chat_id == this.currentChatId)?.partner_id,
            content: '',
            mediaUrl: url,
            type: 'sticker',
        });
        const pickerPanel = document.getElementById('emojiPickerPanel');
        if (pickerPanel) pickerPanel.style.display = 'none';
        this.closeAllModals();
    }

    // Search is now handled by tab-specific searchGiphy and searchGiphyStickers

    saveRecentEmoji(emoji) {
        let recents = JSON.parse(localStorage.getItem("recentEmojis")) || [];
        recents = recents.filter(e => e !== emoji);
        recents.unshift(emoji);
        if (recents.length > 30) recents.pop();
        localStorage.setItem("recentEmojis", JSON.stringify(recents));
    }

    sendSticker(url) {
        this.toggleEmojiPicker();
        this.socket.emit('send-message', {
            chatId: this.currentChatId,
            partnerId: this.conversations.find(c => c.chat_id == this.currentChatId)?.partner_id,
            content: '',
            type: 'image',
            mediaUrl: url
        });
    }

    sendContactCard() {
        this.toggleEmojiPicker();
        this.socket.emit('send-message', {
            chatId: this.currentChatId,
            partnerId: this.conversations.find(c => c.chat_id == this.currentChatId)?.partner_id,
            content: `Contact: @${window.sparkleUser.username}`,
            type: 'text'
        });
    }

    insertEmoji(emoji) {
        this.saveRecentEmoji(emoji);
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
        if (body) {
            navigator.clipboard.writeText(body).then(() => {
                alert('Copied to clipboard!');
                this.closeMessageActionMenu();
            });
        }
    }

    // ==========================================
    // MODAL SYSTEM (WhatsApp-Style)
    // ==========================================

    openMessageSettings() {
        const modal = document.getElementById('messageSettingsModal');
        if (modal) modal.style.display = 'flex';
        this.updateViewState('settings');
    }

    updateViewState(view) {
        const fab = document.getElementById('waFabContainer');
        const sidebar = document.querySelector('.conversation-sidebar');
        if (view === 'chat') {
            if (fab) fab.style.display = 'none';
            if (window.innerWidth <= 768 && sidebar) sidebar.style.display = 'none';
        } else {
            if (fab) fab.style.display = 'flex';
            if (sidebar) sidebar.style.display = 'flex';
        }
    }

    openModal(panelId) {
        this.closeAllModals();
        const panel = document.getElementById(panelId);
        if (!panel) return;
        panel.style.display = 'flex';
        let backdrop = document.getElementById('modalBackdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'modalBackdrop';
            backdrop.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:8989;background:rgba(0,0,0,0);';
            document.body.appendChild(backdrop);
        }
        backdrop.style.display = 'block';
        backdrop.onclick = () => this.closeAllModals();
        this._activeModal = panelId;
    }

    closeAllModals() {
        document.querySelectorAll('.modal-overlay-target, .wa-modal-overlay').forEach(el => {
            if (el.id !== 'emojiPickerPanel') el.style.display = 'none';
        });
        const backdrop = document.getElementById('modalBackdrop');
        if (backdrop) backdrop.style.display = 'none';
        this._activeModal = null;
    }

    toggleEmojiPicker(e) {
        if (e) e.stopPropagation();
        const picker = document.getElementById('emojiPickerPanel');
        if (!picker) return;
        const isVisible = picker.style.display === 'flex';
        if (isVisible) {
            this.closeAllModals();
        } else {
            this.openModal('emojiPickerPanel');
            this.renderEmojiGrid('');
        }
    }

    toggleAttachmentMenu(e) {
        if (e) e.stopPropagation();
        const menu = document.getElementById('attachmentMenu');
        if (!menu) return;
        const isVisible = menu.style.display === 'flex';
        if (isVisible) {
            this.closeAllModals();
        } else {
            this.openModal('attachmentMenu');
        }
    }

    // Unified Keyboard/Viewport Fix
    initViewportHeight() {
        const setVh = () => {
            let vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };
        setVh();
        window.addEventListener('resize', setVh);
        
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                const bottomBar = document.querySelector('.bottom-nav');
                if (bottomBar) {
                    // If viewport is smaller than screen (keyboard up), hide bottom nav to avoid "floating"
                    bottomBar.style.display = window.visualViewport.height < window.innerHeight * 0.8 ? 'none' : '';
                }
                // Ensure composer stays above keyboard if needed, but the user wants it to NOT be obscured
                // We'll trust the browser's scrolling for now or add explicit adjustment if needed.
            });
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
        } catch (err) { }
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
        } catch (err) { }
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
                    headers: { 'Content-Type': 'application/json' },
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
        const nameInput = document.getElementById('groupNameInput');
        const name = nameInput.value.trim();
        const fileRef = document.getElementById('groupIconInput').files[0];

        if (!name || this.selectedGroupUsers.length === 0) {
            alert('Please provide a group name and select at least one member!');
            return;
        }

        const formData = new FormData();
        formData.append('name', name);
        // Backend expects 'member_ids' as an array or JSON string depending on parser
        formData.append('member_ids', JSON.stringify(this.selectedGroupUsers.map(u => u.id)));
        if (fileRef) formData.append('pfp', fileRef);

        const btn = event?.currentTarget;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner-pink" style="width:20px;height:20px;"></div> Creating...';
        }

        try {
            const res = await fetch('/api/groupChat', {
                method: 'POST',
                body: formData
            });
            const result = await res.json();
            if (result.status === 'success') {
                this.closeNewChatModal(true);
                // Clear state
                nameInput.value = '';
                this.selectedGroupUsers = [];
                
                await this.loadInbox();
                if (result.data.chatId) {
                    this.openChat(result.data.chatId);
                }
            } else {
                alert('Group creation failed: ' + result.error);
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="bi bi-people-fill"></i> Create Group';
                }
            }
        } catch (err) {
            console.error(err);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-people-fill"></i> Create Group';
            }
        }
    }



    openAttachment(type) {
        this.toggleAttachmentMenu();
        const input = document.getElementById('mediaUpload');
        if (type === 'Gallery' || type === 'Camera') {
            if (type === 'Gallery') {
                input.setAttribute('accept', 'image/*,video/*');
                input.click();
            } else {
                this.openCameraInterface();
            }
        } else if (type === 'Contact') {
            this.openFollowerShareModal();
        } else if (type === 'Location') {
             navigator.geolocation.getCurrentPosition((pos) => {
                 this.sendLocationMessage(pos.coords.latitude, pos.coords.longitude);
             }, (err) => {
                 alert("Location access denied or unavailable.");
             });
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
            if (el) {
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
        if (this.cameraStream) {
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
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
    }

    cameraCaptureStart() {
        if (this.cameraMode === 'video' || this.cameraMode === 'videonote') {
            if (this.isRecordingCamera) {
                this.cameraCaptureEnd();
            } else {
                this.startRecordingCamera();
            }
            return;
        }

        this.cameraPressTimer = Date.now();
        const inner = document.getElementById('cameraCaptureInner');
        if (inner) inner.style.transform = 'scale(0.8)';

        this.cameraHoldTimeout = setTimeout(() => {
            this.startRecordingCamera();
        }, 500);
    }

    startRecordingCamera() {
        const inner = document.getElementById('cameraCaptureInner');
        this.isRecordingCamera = true;
        if (inner) {
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
        if (this.cameraMode === 'video' || this.cameraMode === 'videonote') return;

        if (this.cameraHoldTimeout) clearTimeout(this.cameraHoldTimeout);

        const inner = document.getElementById('cameraCaptureInner');
        if (inner) {
            inner.style.background = '#fff';
            inner.style.transform = 'scale(1)';
            inner.style.borderRadius = '50%';
        }

        const duration = Date.now() - (this.cameraPressTimer || 0);
        if (duration < 500) {
            this.captureCameraPhoto();
        } else if (this.isRecordingCamera) {
            this.isRecordingCamera = false;
            if (this.cameraRecorder && this.cameraRecorder.state !== 'inactive') {
                this.cameraRecorder.stop();
            }
        }
    }

    captureCameraPhoto() {
        const video = document.getElementById('cameraVideo');
        if (!video || !this.cameraStream) return;

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

            if (data && data.length > 0) {
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
        } catch (e) {
            list.innerHTML = `<div style="color:red; font-size:12px;">Failed to load contacts.</div>`;
        }
    }

    shareContact(userId, username, avatar_url, numFollowers) {
        document.getElementById('followerShareModal').style.display = 'none';
        
        const payload = {
            userId: userId,
            username: username,
            avatar: avatar_url || '/uploads/avatars/default.png',
            followersCount: numFollowers || 0
        };

        this.socket.emit('send-message', {
            chatId: this.currentChatId,
            recipientId: this.conversations.find(c => c.chat_id == this.currentChatId)?.partner_id,
            content: JSON.stringify(payload),
            type: 'contact',
        });
    }

    sendLocationMessage(lat, lng) {
        const payload = { lat, lng };
        this.socket.emit('send-message', {
            chatId: this.currentChatId,
            recipientId: this.conversations.find(c => c.chat_id == this.currentChatId)?.partner_id,
            content: JSON.stringify(payload),
            type: 'location',
        });
    }

    // --- Chat Actions & Settings ---

    toggleChatMenu() {
        const menu = document.getElementById('chatDropdownMenu');
        if (!menu) return;
        const isVisible = menu.style.display === 'block';
        menu.style.display = isVisible ? 'none' : 'block';

        // Side-effect: check if current chat is group to show group settings
        const conv = this.conversations.find(c => c.chat_id === this.currentChatId);
        const groupBtn = document.getElementById('menuGroupSettings');
        if (groupBtn) groupBtn.style.display = conv?.is_group ? 'block' : 'none';
    }

    openChatSettings() {
        const conv = this.conversations.find(c => c.chat_id === this.currentChatId);
        if (!conv) return;

        if (conv.is_group) {
            this.handleGroupSettings();
            return;
        }

        const modal = document.getElementById('chatSettingsModal');
        if (!modal) return;

        document.getElementById('settingsAvatar').src = conv.partner_avatar || '/uploads/avatars/default.png';
        document.getElementById('settingsName').textContent = conv.partner_name;
        document.getElementById('settingsStatus').textContent = conv.bio || 'Hey there! I am using Sparkle.';

        // Fetch Mutual Groups
        const mutualList = document.getElementById('commonGroupsList');
        if (mutualList) {
            mutualList.innerHTML = '<div style="color:#8696a0; font-size:12px;">Loading mutual groups...</div>';
            fetch(`/api/messages/mutual-groups/${conv.partner_id}`)
                .then(r => r.json())
                .then(res => {
                    if (res.status === 'success' && res.data.length > 0) {
                        mutualList.innerHTML = res.data.map(g => `
                            <div style="display:flex; align-items:center; gap:12px; margin-top:10px;">
                                <img src="${g.photo_url || '/uploads/avatars/default.png'}" style="width:30px; height:30px; border-radius:50%;">
                                <div style="font-size:14px;">${g.name}</div>
                            </div>
                        `).join('');
                    } else {
                        mutualList.innerHTML = '<div style="color:#8696a0; font-size:12px;">No groups in common</div>';
                    }
                }).catch(() => {
                    mutualList.innerHTML = '<div style="color:#8696a0; font-size:12px;">None</div>';
                });
        }

        // Replace "Username" in block/delete labels
        const blockBtn = document.getElementById('menuBlock');
        if (blockBtn) blockBtn.textContent = `Block ${conv.partner_name}`;

        modal.style.display = 'flex';
    }

    handleArchiveChat() {
        if (!this.currentChatId) return;
        this.socket.emit('archive_chat', { chatId: this.currentChatId });
        this.closeChat();
        this.loadInbox();
    }

    handleDeleteChat() {
        if (!this.currentChatId) return;
        if (confirm('Are you sure you want to delete this chat forever?')) {
            this.socket.emit('delete_chat', { chatId: this.currentChatId });
            this.closeChat();
            this.loadInbox();
        }
    }

    handleBlockUser() {
        const conv = this.conversations.find(c => c.chat_id === this.currentChatId);
        if (!conv) return;
        if (confirm(`Block ${conv.partner_name}?`)) {
            fetch(`/api/users/block/${conv.partner_id}`, {
                method: 'POST'
            }).then(() => {
                this.closeChat();
                this.loadInbox();
                alert('User blocked');
            });
        }
    }

    handleMuteNotifications() {
        const chatId = this.currentChatId;
        const isMuted = false; // logic would fetch current state
        this.socket.emit('mute_chat', { chatId, mute: !isMuted });
        alert('Notification settings updated');
    }

    async handleGroupSettings() {
        const chatId = this.currentChatId;
        const modal = document.getElementById('groupDetailsModal');
        if (!modal) return;

        try {
            const res = await fetch(`/api/messages/group/${chatId}/details`);
            const result = await res.json();

            if (result.status === 'success') {
                const group = result.data;
                document.getElementById('groupSettingsAvatar').src = group.photo_url || group.photoUrl || '/uploads/avatars/default.png';
                document.getElementById('groupSettingsName').textContent = group.name;
                document.getElementById('groupSettingsDesc').textContent = group.description || 'No description provided';
                document.getElementById('groupMemberCount').textContent = `${group.members?.length || 0} members`;

                const list = document.getElementById('groupMembersList');
                list.innerHTML = group.members.map(m => `
                    <div style="display:flex; align-items:center; gap:12px;">
                        <img src="${m.avatar_url || '/uploads/avatars/default.png'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                        <div style="flex:1;">
                            <div style="font-weight:600;">${m.username} ${m.user_id === this.userId ? '(You)' : ''}</div>
                            <div style="font-size:12px; color:#8696a0;">${m.role}</div>
                        </div>
                        ${(group.role === 'admin' || group.role === 'creator') && m.user_id !== this.userId ? `
                            <i class="bi bi-three-dots-vertical" style="cursor:pointer; color:#8696a0;"></i>
                        ` : ''}
                    </div>
                `).join('');

                modal.style.display = 'flex';
            }
        } catch (e) {
            console.error('Error fetching group info:', e);
            alert('Could not load group settings');
        }
    }

    handleLeaveGroup() {
        if (!this.currentChatId) return;
        if (confirm('Are you sure you want to leave this group?')) {
            this.socket.emit('leave_group', { chatId: this.currentChatId });
            this.closeChat();
            this.loadInbox();
        }
    }

    openDisappearingMessages() {
        document.getElementById('disappearingModal').style.display = 'flex';
    }

    setDisappearing(hours) {
        this.socket.emit('disappearing_messages', { chatId: this.currentChatId, duration: hours });
        document.getElementById('disappearingModal').style.display = 'none';
        // Feedback will come via socket 'disappearing_messages_update'
    }

    handleDisappearingUpdate(data) {
        const { chatId, duration } = data;
        const conv = this.conversations.find(c => c.chat_id == chatId);
        if (conv) {
            conv.disappearing_duration = duration;
            if (this.currentChatId == chatId) {
                this.updateChatHeader(chatId);
            }
        }
    }

    toggleChatLock() {
        const pin = prompt('Enter a 4-digit PIN to lock this chat:');
        if (pin && pin.length === 4) {
            this.socket.emit('lock_chat', { chatId: this.currentChatId, pin });
            alert('Chat locked. It will now be hidden until unlocked.');
            this.closeChat();
            this.loadInbox();
        } else if (pin) {
            alert('Invalid PIN. Must be 4 digits.');
        }
    }

    // --- Long Press / Context Menu ---

    startLongPress(chatId, e) {
        this.longPressTimer = setTimeout(() => {
            this.showChatActions(chatId, e);
        }, 600);
    }

    endLongPress() {
        clearTimeout(this.longPressTimer);
    }

    showChatActions(chatId, e) {
        this.activeChatTarget = chatId;
        const modal = document.getElementById('chatActionModal');
        modal.style.display = 'flex';

        // Vibration for tactile feedback
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(50);
        }
    }

    // --- Chat Action Handlers ---

    async handleArchiveChat() {
        const chatId = this.activeChatTarget || this.currentChatId;
        if (!chatId) return;

        try {
            const res = await fetch(`/api/messages/chat/${chatId}/archive`, { method: 'POST' });
            if (res.ok) {
                this.conversations = this.conversations.filter(c => c.chat_id !== chatId);
                this.renderInbox();
                document.getElementById('chatActionModal').style.display = 'none';
                if (this.currentChatId === chatId) this.closeChat();
            }
        } catch (e) { }
    }

    async handleMuteNotifications() {
        const chatId = this.activeChatTarget || this.currentChatId;
        if (!chatId) return;

        try {
            const res = await fetch(`/api/messages/chat/${chatId}/mute`, { method: 'POST' });
            if (res.ok) {
                alert('Chat muted');
                document.getElementById('chatActionModal').style.display = 'none';
            }
        } catch (e) { }
    }

    async handleDeleteChat() {
        const chatId = this.activeChatTarget || this.currentChatId;
        if (!chatId || !confirm('Permanently delete all messages in this chat?')) return;

        try {
            const res = await fetch(`/api/messages/chat/${chatId}`, { method: 'DELETE' });
            if (res.ok) {
                // Point 4 & 8: Keep relationship, clear messages
                if (this.currentChatId === chatId) {
                    const messagesContainer = document.getElementById('messagesContainer');
                    if (messagesContainer) {
                        messagesContainer.innerHTML = '<div class="date-divider">Messages deleted</div>';
                    }
                    this._renderedIds = new Set();
                }
                
                // Refresh inbox to update last_message status etc.
                await this.loadInbox();
                
                // Point 4: Re-render header to fix "Loading..." or status issues
                if (this.currentChatId === chatId) {
                    this.updateChatHeader(chatId);
                }
                
                document.getElementById('chatActionModal').style.display = 'none';
            }
        } catch (e) { 
            console.error('Delete error:', e);
        }
    }

    async handleBlockUser() {
        const conv = this.conversations.find(c => c.chat_id === (this.activeChatTarget || this.currentChatId));
        if (!conv || !conv.partner_id || !confirm(`Block ${conv.partner_name}?`)) return;

        try {
            const res = await fetch(`/api/users/block/${conv.partner_id}`, {
                method: 'POST'
            });
            if (res.ok) {
                alert('User blocked');
                document.getElementById('chatActionModal').style.display = 'none';
                this.handleDeleteChat();
            }
        } catch (e) { }
    }

    // --- Invite & Link ---

    openInviteModal() {
        const conv = this.conversations.find(c => c.chat_id === this.currentChatId);
        if (!conv || !conv.is_group) return;

        const modal = document.getElementById('inviteModal');
        const linkText = document.getElementById('inviteLinkText');
        const qrImg = document.getElementById('groupQR');

        const inviteUrl = `${window.location.origin}/join/${conv.chat_id}`; // Simplified backend-less generation
        linkText.textContent = inviteUrl;
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteUrl)}`;

        modal.style.display = 'flex';
    }

    copyInviteLink() {
        const text = document.getElementById('inviteLinkText').textContent;
        navigator.clipboard.writeText(text).then(() => {
            alert('Invite link copied to clipboard');
        });
    }

    // --- Media Visibility & Storage ---

    openMediaVisibility() {
        document.getElementById('mediaVisibilityModal').style.display = 'flex';
    }

    saveMediaVisibility() {
        const val = document.querySelector('input[name="mediaVis"]:checked').value;
        this.socket.emit('set_media_visibility', { chatId: this.currentChatId, visibility: val });
        document.getElementById('mediaVisibilityModal').style.display = 'none';
        alert('Media visibility updated');
    }

    openStorageManagement() {
        document.getElementById('storageModal').style.display = 'flex';
        // Mocking statistics for UX demo
        document.getElementById('totalStorageUsed').textContent = '12.4 MB';
        document.getElementById('storageImages').textContent = '8.2 MB';
        document.getElementById('storageVideos').textContent = '4.1 MB';
        document.getElementById('storageVoice').textContent = '120 KB';
        document.getElementById('storageDocs').textContent = '28 KB';
    }

    clearChatMedia() {
        if (confirm('Are you sure you want to delete all media files in this chat? This cannot be undone.')) {
            this.socket.emit('clear_chat_media', { chatId: this.currentChatId });
            alert('Storage cleared');
            document.getElementById('storageModal').style.display = 'none';
        }
    }

    expandProfilePicture() {
        const conv = this.conversations.find(c => c.chat_id === this.currentChatId);
        if (!conv) return;

        const modal = document.getElementById('pfpExpandModal');
        const img = document.getElementById('expandedPfp');
        const name = document.getElementById('expandedPartnerName');

        if (modal && img && name) {
            img.src = conv.partner_avatar || '/uploads/avatars/default.png';
            name.textContent = conv.partner_name;
            modal.style.display = 'flex';
        }
    }

    scrollToBottom(force = false) {
        const container = document.getElementById('messagesContainer');
        if (!container) return;

        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 400;
        if (force || isNearBottom) {
            // Scroll to slightly above the absolute bottom so the last message
            // sits clearly above the input bar and is never hidden behind it.
            const composer = document.querySelector('.chat-composer');
            const composerH = composer ? composer.offsetHeight : 70;
            const targetScroll = container.scrollHeight - composerH - 8;
            container.scrollTop = Math.max(targetScroll, container.scrollHeight - container.clientHeight);

            const badge = document.getElementById('newMsgBadge');
            if (badge) badge.style.display = 'none';
        } else {
            const badge = document.getElementById('newMsgBadge');
            if (badge) badge.style.display = 'block';
        }
    }


    formatChatTime(dateString) {
        if (!dateString) return '';
        // Normalize: turn "YYYY-MM-DD HH:MM:SS" into UTC ISO
        let normalized = typeof dateString === 'string' ? dateString.replace(' ', 'T') : dateString;
        if (typeof normalized === 'string' && !normalized.includes('Z') && !normalized.includes('+')) {
            normalized += 'Z';
        }
        const now = new Date();
        const msgTime = new Date(normalized);
        if (isNaN(msgTime.getTime())) return '';

        const diff = Math.floor((now - msgTime) / 1000);

        // Prevent negative values from clock drift
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;

        const today = now.toDateString();
        const msgDay = msgTime.toDateString();

        if (today === msgDay) {
            return msgTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (msgDay === yesterday.toDateString()) return 'Yesterday';

        return msgTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    formatLastSeen(lastSeen, isOnline) {
        if (isOnline) return 'Online';
        if (!lastSeen) return 'Offline';
        // Normalize: turn "YYYY-MM-DD HH:MM:SS" into UTC ISO
        let normalized = typeof lastSeen === 'string' ? lastSeen.replace(' ', 'T') : lastSeen;
        if (typeof normalized === 'string' && !normalized.includes('Z') && !normalized.includes('+')) {
            normalized += 'Z';
        }
        const date = new Date(normalized);
        if (isNaN(date.getTime())) return 'Offline';
        return 'Last seen ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    formatTime(dateString) {
        if (!dateString) return '';
        // Normalize: turn "YYYY-MM-DD HH:MM:SS" into UTC ISO
        let normalized = typeof dateString === 'string' ? dateString.replace(' ', 'T') : dateString;
        if (typeof normalized === 'string' && !normalized.includes('Z') && !normalized.includes('+')) {
            normalized += 'Z';
        }
        const date = new Date(normalized);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    formatFullDate(dateString) {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        const today = new Date();
        if (date.toDateString() === today.toDateString()) return 'Today';
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    startUpdateTimeLoop() {
        if (this.updateTimesInterval) clearInterval(this.updateTimesInterval);
        this.updateTimesInterval = setInterval(() => {
            this.updateChatTimes();
        }, 1000);
    }

    updateChatTimes() {
        document.querySelectorAll('.chat-time').forEach(el => {
            const time = el.dataset.time;
            if (time && time !== 'undefined' && time !== 'null') {
                el.textContent = this.formatChatTime(time);
            }
        });
    }

    closeChat() {
        document.querySelector('.messaging-layout').classList.remove('chat-active');
        this.currentChatId = null;

        // Close any open modals
        this.closeAllModals();

        // Hide input bar
        const composer = document.querySelector('.chat-composer, footer.wa-composer');
        if (composer) composer.style.display = 'none';

        // Show FAB back
        const fab = document.getElementById('waFabContainer');
        if (fab) fab.style.display = 'flex';
    }

    // --- Group System Logic ---

    async openGroupInfo() {
        if (!this.currentChatId) return;
        const conv = this.conversations.find(c => c.chat_id === this.currentChatId);
        if (!conv) return;

        // If not a group, maybe show a simplified user profile drawer? 
        // For now, only for groups as requested.
        if (conv.chat_type !== 'group') return;

        const drawer = document.getElementById('groupInfoDrawer');
        drawer.style.display = 'flex';

        // Set initial data from local conversation
        document.getElementById('groupInfoName').textContent = conv.partner_name;
        document.getElementById('groupInfoPhoto').src = conv.partner_avatar || '/uploads/avatars/default.png';
        document.getElementById('groupInfoMemberCount').textContent = conv.member_count || '...';
        document.getElementById('groupInfoMemberLabel').textContent = (conv.member_count || '0') + ' members';

        // Load full details from API
        try {
            const res = await fetch(`/api/groupChat/${this.currentChatId}`);
            const result = await res.json();
            if (result.status === 'success') {
                const chat = result.data;
                this.renderGroupDetailsUI(chat);
            }
        } catch (e) {
            console.error('Failed to load group details:', e);
        }
    }

    renderGroupDetailsUI(chat) {
        document.getElementById('groupInfoCreator').textContent = chat.creator_name || 'Admin';
        document.getElementById('groupInfoDate').textContent = new Date(chat.created_at).toLocaleDateString();
        document.getElementById('groupInfoMemberCount').textContent = chat.members.length;
        document.getElementById('groupInfoMemberLabel').textContent = chat.members.length + ' members';

        // Check if current user is admin
        const me = chat.members.find(m => m.user_id === this.userId);
        const isAdmin = me && (me.role === 'admin' || me.role === 'creator');
        document.getElementById('groupInfoPhotoEdit').style.display = isAdmin ? 'flex' : 'none';
        document.getElementById('groupInfoAddMemberBtn').style.display = isAdmin ? 'flex' : 'none';

        this.renderGroupMembers(chat.members, isAdmin);
    }

    async updateGroupPhoto(input) {
        if (!input.files || !input.files[0] || !this.currentChatId) return;
        
        const formData = new FormData();
        formData.append('pfp', input.files[0]);

        try {
            const res = await fetch(`/api/groupChat/${this.currentChatId}`, {
                method: 'PUT',
                body: formData
            });
            const result = await res.json();
            if (result.status === 'success') {
                await this.openGroupInfo(); // Refresh drawer
                await this.loadInbox();      // Refresh sidebar icon
            }
        } catch (e) {
            console.error('Failed to update group photo:', e);
        }
    }

    renderGroupMembers(members, canManage) {
        const list = document.getElementById('groupMemberList');
        list.innerHTML = members.map(m => `
            <div class="user-search-result" style="padding: 12px 20px; cursor: default;">
                <img src="${m.avatar_url || '/uploads/avatars/default.png'}" 
                     onclick="sparkChat.openMemberProfile('${m.user_id}', '${m.name}', '${m.avatar_url}', '${m.is_online ? 'Online' : 'Offline'}')"
                     style="width:40px;height:40px;border-radius:50%;object-fit:cover;cursor:pointer;">
                <div class="flex-1" onclick="sparkChat.openMemberProfile('${m.user_id}', '${m.name}', '${m.avatar_url}', '${m.is_online ? 'Online' : 'Offline'}')" style="cursor:pointer;">
                    <div style="font-weight:600; font-size:15px;">${m.name} ${m.user_id === this.userId ? '(You)' : ''}</div>
                    <div style="font-size:12px; color:#888;">${m.is_online ? '<span style="color:#00a884;">online</span>' : 'offline'}</div>
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                    ${m.role === 'admin' || m.role === 'creator' ? '<span style="font-size:9px; color:#00a884; border:1px solid #00a884; padding:0px 4px; border-radius:3px; font-weight:700;">ADMIN</span>' : ''}
                    ${canManage && m.user_id !== this.userId ? `
                        <div class="member-admin-actions" style="display:flex; gap:4px;">
                            ${m.role !== 'admin' && m.role !== 'creator' ? `
                                <button onclick="sparkChat.updateMemberRole('${m.user_id}', 'admin')" 
                                        style="background:none; border:none; color:#00a884; font-size:16px; cursor:pointer;" title="Promote to Admin">
                                    <i class="bi bi-shield-plus"></i>
                                </button>
                            ` : (m.role === 'admin' ? `
                                <button onclick="sparkChat.updateMemberRole('${m.user_id}', 'member')" 
                                        style="background:none; border:none; color:#64748b; font-size:16px; cursor:pointer;" title="Dismiss as Admin">
                                    <i class="bi bi-shield-slash"></i>
                                </button>
                            ` : '')}
                            <button onclick="sparkChat.removeGroupMember('${m.user_id}')" 
                                    style="background:none; border:none; color:#ea4335; font-size:16px; cursor:pointer;" title="Remove">
                                <i class="bi bi-person-x-fill"></i>
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    async updateMemberRole(userId, role) {
        if (!confirm(`Are you sure you want to ${role === 'admin' ? 'promote' : 'dismiss'} this member?`)) return;
        try {
            const res = await fetch(`/api/groupChat/${this.currentChatId}/members/${userId}/role`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role })
            });
            const result = await res.json();
            if (result.status === 'success') {
                this.openGroupInfo(); // Refresh
            } else {
                alert(result.error || 'Failed to update role');
            }
        } catch (e) {
            console.error(e);
        }
    }

    async removeGroupMember(userId) {
        if (!confirm('Remove this member from group?')) return;
        try {
            const res = await fetch(`/api/groupChat/${this.currentChatId}/members/${userId}`, {
                method: 'DELETE'
            });
            const result = await res.json();
            if (result.status === 'success') {
                this.openGroupInfo(); // Refresh member list
            } else {
                alert(result.error || 'Failed to remove member');
            }
        } catch (e) {
            console.error(e);
        }
    }

    closeGroupInfo() {
        const drawer = document.getElementById('groupInfoDrawer');
        if (drawer) drawer.style.display = 'none';
    }

    async leaveGroup() {
        if (!confirm('Are you sure you want to leave this group?')) return;
        try {
            const res = await fetch(`/api/groupChat/${this.currentChatId}/leave`, { method: 'POST' });
            const result = await res.json();
            if (result.status === 'success') {
                this.closeGroupInfo();
                this.closeChat();
                await this.loadInbox();
            }
        } catch (e) {
            alert('Failed to leave group');
        }
    }

    openMemberProfile(id, name, avatar, status) {
        const modal = document.getElementById('memberProfileModal');
        if (!modal) return;

        document.getElementById('memberModalPfp').src = avatar || '/uploads/avatars/default.png';
        document.getElementById('memberModalName').textContent = name;
        document.getElementById('memberModalStatus').textContent = status;
        document.getElementById('memberModalStatus').style.color = status === 'Online' ? '#00a884' : '#888';

        // Set actions visibility
        const isMe = id === this.userId;
        const msgBtn = document.querySelector('.member-modal-msg-btn');
        if (msgBtn) msgBtn.style.display = isMe ? 'none' : 'block';

        this._selectedMember = { id, name, avatar };
        modal.style.display = 'flex';
    }

    async messageMember() {
        if (!this._selectedMember) return;
        document.getElementById('memberProfileModal').style.display = 'none';
        this.closeGroupInfo();
        
        try {
            const res = await fetch('/api/messages/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ partnerId: this._selectedMember.id })
            });
            const result = await res.json();
            if (result.status === 'success') {
                this.openChat(result.data.conversationId);
            }
        } catch (err) { console.error(err); }
    }

    async openAddMemberModal() {
        this.closeGroupInfo();
        const modal = document.getElementById('addMemberToGroupModal');
        if(!modal) return;
        
        modal.style.display = 'flex';
        const listEl = document.getElementById('addMemberList');
        listEl.innerHTML = '<div style="padding:20px;text-align:center;color:#667781;">Loading contacts...</div>';
        
        try {
            const res = await fetch('/api/users/following');
            const result = await res.json();
            const users = result.data || result.users || (Array.isArray(result) ? result : []);
            this._addMemberContacts = users;
            this.renderAddMemberList(users);
        } catch (e) {
            listEl.innerHTML = '<div style="padding:20px;text-align:center;color:#ea4335;">Failed to load contacts.</div>';
        }
    }

    renderAddMemberList(users) {
        const listEl = document.getElementById('addMemberList');
        if(users.length === 0) {
            listEl.innerHTML = '<div style="padding:20px;text-align:center;color:#667781;">No eligible contacts found.</div>';
            return;
        }

        // Get existing members to disable/exclude them
        let existingIds = new Set();
        if(this.currentChatId) {
            const conv = this.conversations.find(c => c.chat_id === this.currentChatId);
            if(conv && conv.members) { // Though `members` may not be in conv directly, we'll try API approach
                 // Wait, we don't have existing members in local state easily unless we just loaded group details.
            }
        }
        // Let user select any and the backend will filter.

        listEl.innerHTML = users.map(u => `
            <div style="display:flex; align-items:center; padding:10px 15px; cursor:pointer; border-bottom:1px solid #f0f2f5; transition:background 0.2s;" onmouseover="this.style.background='#f0f2f5'" onmouseout="this.style.background=''" onclick="sparkChat.submitAddMember('${u.user_id}')">
                <img src="${u.avatar_url || '/uploads/avatars/default.png'}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;margin-right:12px;">
                <div style="flex:1;">
                    <div style="font-size:15px;color:#111b21;font-weight:500;">${u.name}</div>
                    <div style="font-size:13px;color:#667781;">@${u.username}</div>
                </div>
                <div style="width:24px; height:24px; border-radius:50%; border:1px solid #d1d5db; display:flex; align-items:center; justify-content:center;">
                    <i class="bi bi-plus" style="font-size:16px; color:#54656f;"></i>
                </div>
            </div>
        `).join('');
    }

    filterAddMembers() {
        const query = (document.getElementById('addMemberSearchInput').value || '').toLowerCase();
        if(!this._addMemberContacts) return;
        const filtered = this._addMemberContacts.filter(u => 
            (u.name && u.name.toLowerCase().includes(query)) || 
            (u.username && u.username.toLowerCase().includes(query))
        );
        this.renderAddMemberList(filtered);
    }

    async submitAddMember(userId) {
        if(!this.currentChatId) return;
        try {
            const res = await fetch(`/api/groupChat/${this.currentChatId}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_ids: [userId] })
            });
            const result = await res.json();
            if(result.status === 'success') {
                document.getElementById('addMemberToGroupModal').style.display = 'none';
                this.openGroupInfo(); // Refresh UI
            } else {
                alert(result.error || 'Failed to add member');
            }
        } catch(e) {
            console.error(e);
            alert('Failed to add member.');
        }
    }

    // ==========================================
    // AUDIO PLAYBACK
    // ==========================================

    playAudio(btn, url) {
        if (this._currentAudio && this._currentAudio.src === url) {
            if (this._currentAudio.paused) {
                this._currentAudio.play();
                btn.innerHTML = '<i class="bi bi-pause-fill" style="font-size:24px;"></i>';
            } else {
                this._currentAudio.pause();
                btn.innerHTML = '<i class="bi bi-play-fill" style="font-size:24px;"></i>';
            }
            return;
        }

        if (this._currentAudio) {
            this._currentAudio.pause();
            const prevBtn = this._currentAudio._btn;
            if (prevBtn) prevBtn.innerHTML = '<i class="bi bi-play-fill" style="font-size:24px;"></i>';
        }

        const audio = new Audio(url);
        audio._btn = btn;
        this._currentAudio = audio;

        const progress = btn.parentElement.querySelector('.audio-progress');
        const durationEl = btn.parentElement.querySelector('.audio-duration');

        audio.addEventListener('timeupdate', () => {
            const pct = (audio.currentTime / audio.duration) * 100;
            if (progress) progress.style.width = pct + '%';
            if (durationEl) durationEl.textContent = this.formatAudioTime(audio.currentTime);
        });

        audio.addEventListener('loadedmetadata', () => {
            if (durationEl) durationEl.textContent = this.formatAudioTime(audio.duration);
        });

        audio.addEventListener('ended', () => {
            btn.innerHTML = '<i class="bi bi-play-fill" style="font-size:24px;"></i>';
            if (progress) progress.style.width = '0%';
        });

        audio.play();
        btn.innerHTML = '<i class="bi bi-pause-fill" style="font-size:24px;"></i>';
    }

    formatAudioTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    // --- Message Information & Metadata ---

    handleViewUpdate(data) {
        const { messageId, viewsUsed } = data;
        const msgEl = document.querySelector(`.msg-bubble[data-msg-id="${messageId}"]`);
        if (msgEl) {
            const label = msgEl.querySelector('.view-limited-placeholder span');
            if (label) label.textContent = 'Opened';
            msgEl.classList.add('viewed-once');
        }
    }

    formatTime(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    // --- View State & Navigation Controllers ---

    openMessageSettings() {
        const modal = document.getElementById('messageSettingsModal');
        if (modal) modal.style.display = 'flex';
        this.updateViewState('settings');
    }

    openPrivacySettings() {
        const modal = document.getElementById('privacySettingsModal');
        if (modal) {
            modal.style.display = 'flex';
            const mainModal = document.getElementById('messageSettingsModal');
            if (mainModal) mainModal.style.display = 'none';
        }
    }

    async savePrivacy(key, value) {
        console.log(`🔒 Sparkle Privacy: Updating ${key} to ${value}`);
        const val = typeof value === 'boolean' ? (value ? 1 : 0) : value;
        try {
            await fetch('/api/users/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: val })
            });
        } catch (err) {
            console.error('🔒 Privacy update failed:', err);
        }
    }

    updateViewState(view) {
        const fab = document.getElementById('waFabContainer');
        const sidebar = document.querySelector('.conversation-sidebar');
        if (view === 'chat') {
            if (fab) fab.style.display = 'none';
            if (window.innerWidth <= 768 && sidebar) sidebar.style.display = 'none';
        } else {
            if (fab) fab.style.display = 'flex';
            if (sidebar) sidebar.style.display = 'flex';
        }
    }

    closeChat() {
        if(this.currentChatId) {
            this.socket.emit('leave-chat', this.currentChatId);
        }
        this.currentChatId = null;
        const layout = document.querySelector('.messaging-layout');
        if (layout) layout.classList.remove('chat-active');
        const chatMain = document.getElementById('chatMain');
        if (chatMain) chatMain.style.display = 'none';
        const empty = document.getElementById('chatEmptyWindow');
        if (empty) empty.style.display = 'flex';
        
        this.updateViewState('list');
    }

    // ==========================================
    // MODAL SYSTEM (WhatsApp-Style)
    // ==========================================

    openModal(panelId) {
        this.closeAllModals();
        const panel = document.getElementById(panelId);
        if (!panel) return;
        panel.style.display = 'flex';
        let backdrop = document.getElementById('modalBackdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'modalBackdrop';
            backdrop.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:8989;background:rgba(0,0,0,0);';
            document.body.appendChild(backdrop);
        }
        backdrop.style.display = 'block';
        backdrop.onclick = () => this.closeAllModals();
        this._activeModal = panelId;
    }

    closeAllModals() {
        document.querySelectorAll('.modal-overlay-target, .wa-modal-overlay, .emoji-picker-panel, .attachment-menu').forEach(el => {
            if (el.id !== 'emojiPickerPanel') el.style.display = 'none';
        });
        const backdrop = document.getElementById('modalBackdrop');
        if (backdrop) backdrop.style.display = 'none';
        this._activeModal = null;
    }

    openModal(panelId) {
        this.closeAllModals();
        const panel = document.getElementById(panelId);
        if (!panel) return;
        panel.style.display = 'flex';
        let backdrop = document.getElementById('modalBackdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'modalBackdrop';
            backdrop.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:8989;background:rgba(0,0,0,0);';
            document.body.appendChild(backdrop);
        }
        backdrop.style.display = 'block';
        backdrop.onclick = (e) => { e.stopPropagation(); this.closeAllModals(); };
        this._activeModal = panelId;
    }

    closeAllModals() {
        document.querySelectorAll('.modal-overlay-target, .emoji-picker-panel, .attachment-menu').forEach(el => {
            el.style.display = 'none';
        });
        const backdrop = document.getElementById('modalBackdrop');
        if (backdrop) backdrop.style.display = 'none';
        this._activeModal = null;
    }

    toggleAttachmentMenu(e) {
        if (e) e.stopPropagation();
        const menu = document.getElementById('attachmentMenu');
        if (!menu) return;
        if (menu.style.display === 'grid') {
            menu.style.display = 'none';
        } else {
            this.closeAllModals();
            menu.style.display = 'grid';
        }
    }

    renderEmojiGrid(query) {
        const grid = document.getElementById('emojiPickerGrid');
        if (!grid) return;
        const list = ['😂','❤️','😍','🔥','✨','👍','🎉','😭','🥰','👏','🙄','🤔','😎','👀','💯','💀','🤩',
                      '😁','😆','😅','😋','😘','🙂','🤗','🤐','😯','😪','😫','🥱','🧐','🤓','😈','💩','👻',
                      '🙌','🤝','👍','👎','👊','✊','🤞','✌️','👌','✋','🖖','👋','🤙','💪','🦾','🙏'];
        const recents = JSON.parse(localStorage.getItem('recentEmojis') || '[]');
        const full = [...new Set([...recents, ...list])];
        const filtered = query ? full.filter(e => e.toLowerCase().includes(query.toLowerCase())) : full;
        grid.innerHTML = filtered.map(e => `<span class="emoji-item" onclick="window.sparkChat.insertEmoji('${e}')">${e}</span>`).join('');
    }

    insertEmoji(emoji) {
        const input = document.getElementById('messageInput');
        if (!input) return;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        input.value = input.value.substring(0, start) + emoji + input.value.substring(end);
        input.selectionStart = input.selectionEnd = start + emoji.length;
        this.autoResizeTextarea(input);
        input.focus();
    }

    sendGif(url) {
        this.closeAllModals();
        this.socket.emit('send-message', {
            chatId: this.currentChatId,
            recipientId: this.conversations.find(c => c.chat_id == this.currentChatId)?.partner_id,
            content: '',
            type: 'image',
            mediaUrl: url
        });
    }

    initViewportHeight() {
        const setVh = () => {
            let vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };
        setVh();
        window.addEventListener('resize', setVh);
    }

    switchEmojiTab(tab, el) {
        document.querySelectorAll('.emoji-tab-icon').forEach(i => i.classList.remove('active'));
        el.classList.add('active');
        this.renderEmojiGrid('');
    }

    handleEmojiSearch(val) {
        this.renderEmojiGrid(val);
    }
}

// Global instance
window.addEventListener('DOMContentLoaded', () => {
    window.sparkChat = new SparkleChat();

    // Close menus on click outside
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('chatDropdownMenu');
        if (menu && !e.target.closest('.chat-menu-wrapper')) {
            menu.style.display = 'none';
        }
        document.querySelectorAll('.msg-options-menu').forEach(m => m.classList.remove('active'));
    });

    // Mobile back button closes modals
    window.addEventListener('popstate', () => {
        if (window.sparkChat) window.sparkChat.closeAllModals();
    });

    // Swipe down on emoji picker to close
    const emojiPanel = document.getElementById('emojiPickerPanel');
    if (emojiPanel) {
        let touchStartY = 0;
        emojiPanel.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
        emojiPanel.addEventListener('touchmove', e => {
            if (e.touches[0].clientY - touchStartY > 80) {
                window.sparkChat?.closeAllModals();
            }
        }, { passive: true });
    }
});

// Mobile support helper
function closeChat() {
    if (window.sparkChat) window.sparkChat.closeChat();
}
