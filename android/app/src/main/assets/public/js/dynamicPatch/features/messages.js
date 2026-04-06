// messages.js

export async function startChat(contact) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.style.zIndex = '3000';
    modal.innerHTML = `
        <div class="modal-content chat-modal-content">
            <div class="modal-header">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="${contact.avatar || '/uploads/avatars/default.png'}" class="chat-avatar">
                    <div style="font-weight: bold;">${contact.name}</div>
                </div>
                <button class="close-modal">&times;</button>
            </div>
            <div id="chatMessages" class="modal-body chat-messages-body">
                <div style="text-align:center; padding:20px; color:#999;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>
            </div>
            <div class="modal-footer">
                <div style="display: flex; gap: 10px; align-items: center;">
                    <input type="text" id="chatMessageInput" class="form-control" placeholder="Type your message...">
                    <button id="sendChatBtn" class="btn btn-primary"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.close-modal');
    closeBtn.onclick = () => modal.remove();

    const sendBtn = modal.querySelector('#sendChatBtn');
    const input = modal.querySelector('#chatMessageInput');

    sendBtn.onclick = () => sendMessageToUser(contact.id, contact.chat_session_id);
    input.onkeypress = (e) => { if (e.key === 'Enter') sendMessageToUser(contact.id, contact.chat_session_id); };

    if (contact.chat_session_id) {
        await renderChatHistory(contact.chat_session_id);
    }
}

export async function renderChatHistory(sessionId) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    try {
        const history = await window.DashboardAPI.loadChatHistory(sessionId);
        container.innerHTML = history.map(msg => `
            <div class="message ${msg.sender_id === window.appState.currentUser.id ? 'me' : 'other'}">
                <div class="message-content">${msg.content}</div>
            </div>
        `).join('');
        container.scrollTop = container.scrollHeight;
    } catch (err) {
        console.error('Failed to load chat history:', err);
    }
}

export async function sendMessageToUser(recipientId, sessionId) {
    const input = document.getElementById('chatMessageInput');
    const content = input?.value.trim();
    if (!content) return;

    try {
        await window.DashboardAPI.sendMessage({ recipient_id: recipientId, chat_session_id: sessionId, content });
        if (input) input.value = '';
        renderChatHistory(sessionId);
    } catch (err) {
        console.error('Failed to send message:', err);
    }
}
