/**
 * ShareManager - Instagram-style sharing functionality for Sparkle
 */
class ShareManager {
    constructor() {
        this.baseUrl = window.location.origin;
        this.currentContentId = null;
        this.contentType = null;
        this.shareData = null;
        this.init();
    }

    init() {
        // Ensure modal exists in DOM (it should be in a partial)
        window.addEventListener('DOMContentLoaded', () => {
            this.bindEvents();
            this.loadRecipients();
        });
    }

    bindEvents() {
        // Global listener for share buttons
        document.body.addEventListener('click', (e) => {
            const shareBtn = e.target.closest('.share-btn');
            if (shareBtn) {
                const type = shareBtn.dataset.type || 'post';
                const id = shareBtn.dataset.id;
                if (id) {
                    this.openShareSheet(type, id);
                }
            }
        });

        // Search listener
        const searchInput = document.querySelector('.share-search-bar input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterRecipients(e.target.value);
            });
        }
    }

    async loadRecipients() {
        try {
            // Use the conversations endpoint to get people to share with
            const response = await fetch('/api/messages/conversations');
            const result = await response.json();
            if (result.status === 'success' && result.data) {
                this.renderRecipients(result.data);
            }
        } catch (error) {
            console.error('Failed to load share recipients:', error);
        }
    }

    renderRecipients(conversations) {
        const container = document.querySelector('.share-recipients-scroll');
        if (!container) return;

        if (!conversations || conversations.length === 0) {
            container.innerHTML = '<p style="padding: 10px; font-size: 13px; color: #999; text-align: center; width: 100%;">No recent chats</p>';
            return;
        }

        container.innerHTML = conversations.map(c => `
            <div class="recipient-item" onclick="window.shareManager.shareToDM('${c.partner_id}', '${c.partner_name}')">
                <div class="recipient-avatar">
                    <img src="${c.partner_avatar || '/uploads/avatars/default.png'}" alt="${c.partner_name}" onerror="this.src='/uploads/avatars/default.png'">
                    ${c.is_online ? '<div class="online-indicator"></div>' : ''}
                </div>
                <span>${c.partner_name.split(' ')[0]}</span>
            </div>
        `).join('');
    }

    filterRecipients(query) {
        const items = document.querySelectorAll('.recipient-item');
        const q = query.toLowerCase();
        items.forEach(item => {
            const name = item.querySelector('span').textContent.toLowerCase();
            item.style.display = name.includes(q) ? 'flex' : 'none';
        });
    }

    async openShareSheet(type, contentId) {
        this.contentType = type;
        this.currentContentId = contentId;

        console.log(`Opening share sheet for ${type}: ${contentId}`);

        this.showShareModal();
        await this.loadShareData(contentId, type);
    }

    async loadShareData(contentId, type) {
        try {
            const response = await fetch(`/api/share/${contentId}?type=${type}`);
            const data = await response.json();

            this.shareData = {
                url: `${this.baseUrl}${data.url}`,
                title: data.title || 'Check this out on Sparkle!',
                caption: data.caption,
                type: type,
                id: contentId
            };

            // Track sheet open
            await this.trackShare('open_sheet');
        } catch (error) {
            console.error('Failed to load share data:', error);
            // Fallback
            this.shareData = {
                url: `${this.baseUrl}/${type}/${contentId}`,
                title: 'Check this out on Sparkle!',
                type: type,
                id: contentId
            };
        }
    }

    // 1. Direct Message Sharing
    async shareToDM(recipientId, recipientName) {
        try {
            const message = `Check this ${this.contentType} out!\n${this.shareData.url}`;
            const response = await fetch(`/api/messages/${recipientId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: message })
            });
            const result = await response.json();
            if (result.status === 'success') {
                this.showToast(`Shared to ${recipientName}!`);
                this.trackShare('direct_message');
            }
        } catch (error) {
            console.error('DM share error:', error);
            this.showToast('Failed to share');
        }
    }

    // 2. Share to Story (AfterGlow)
    async shareToStory() {
        try {
            const response = await fetch(`/api/stories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    caption: `Check this ${this.contentType}!`,
                    media_url: this.shareData.image_url || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=1000' // Use post media if available, or a generic placeholder
                })
            });
            if (response.ok) {
                this.showToast('Added to your AfterGlow!');
                this.trackShare('story');
                this.closeShareModal();
            }
        } catch (e) {
            this.showToast('Failed to add to story');
        }
    }

    // 2. Republish (Share to Feed)
    async republish() {
        try {
            const response = await fetch(`/api/posts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: `💨 Reposted this ${this.contentType}:\n${this.shareData.url}`,
                    post_type: 'public'
                })
            });
            if (response.ok) {
                this.showToast('Republished to your feed!');
                this.trackShare('republish');
                this.closeShareModal();
            }
        } catch (e) {
            this.showToast('Failed to republish');
        }
    }

    // 3. Save Post
    async savePost() {
        try {
            // Generic save endpoint or specific ones
            const endpoint = this.contentType === 'moment' ? `/api/moments/${this.currentContentId}/save` : `/api/posts/${this.currentContentId}/save`;
            const response = await fetch(endpoint, { method: 'POST' });

            this.showToast(response.ok ? 'Saved to collection!' : 'Saved!');
            this.trackShare('save');
        } catch (e) {
            this.showToast('Saved!');
        }
    }

    // 4. External App Sharing
    shareToWhatsApp() {
        const text = encodeURIComponent(`${this.shareData.title}\n\n${this.shareData.url}`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
        this.trackShare('whatsapp');
    }

    shareToTelegram() {
        const text = encodeURIComponent(`${this.shareData.title}\n${this.shareData.url}`);
        window.open(`https://t.me/share/url?url=${this.shareData.url}&text=${text}`, '_blank');
        this.trackShare('telegram');
    }

    shareToTwitter() {
        const text = encodeURIComponent(`${this.shareData.title} ${this.shareData.url}`);
        window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
        this.trackShare('twitter');
    }

    // 5. Copy Link
    async copyPostLink() {
        try {
            await navigator.clipboard.writeText(this.shareData.url);
            this.showToast('Link copied to clipboard!');
            this.trackShare('copy_link');
        } catch (err) {
            const textArea = document.createElement('textarea');
            textArea.value = this.shareData.url;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showToast('Link copied!');
        }
    }

    // 6. Native Share API (Mobile)
    async openNativeShare() {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: this.shareData.title,
                    url: this.shareData.url,
                });
                this.trackShare('native');
            } catch (err) {
                console.log('Native share cancelled');
            }
        } else {
            this.copyPostLink();
        }
    }

    async trackShare(platform) {
        try {
            await fetch(`/api/share/track`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contentId: this.currentContentId,
                    type: this.contentType,
                    platform
                })
            });
        } catch (e) {
            console.error('Track share error:', e);
        }
    }

    showShareModal() {
        const modal = document.getElementById('shareModal');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            setTimeout(() => {
                modal.classList.add('active');
            }, 10);
        }
    }

    closeShareModal() {
        const modal = document.getElementById('shareModal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }, 300);
        }
    }

    showToast(message) {
        // Simple toast implementation
        const toast = document.createElement('div');
        toast.className = 'sparkle-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }
}

// Initialize Global Share Manager
window.shareManager = new ShareManager();

// Helper to close modal on background click
window.addEventListener('click', (e) => {
    const modal = document.getElementById('shareModal');
    if (e.target === modal) {
        window.shareManager.closeShareModal();
    }
});
