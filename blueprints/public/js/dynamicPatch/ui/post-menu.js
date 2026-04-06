/**
 * post-menu.js
 * Handles the high-end post options menu (Delete, Report, Copy Link)
 */

export function initPostMenu() {
    // Expose to window for inline onclick handlers if needed, 
    // though modular approach is preferred.
    window.showPostOptions = showPostOptions;

    // Global click listener to close menu
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.post-options-menu') && !e.target.closest('.post-options-btn')) {
            closeAllMenus();
        }
    });
}

export function showPostOptions(postId, button) {
    // Close any existing menus first
    closeAllMenus();

    // Create menu element
    const menu = document.createElement('div');
    menu.className = 'post-options-menu glass';

    // Check if current user is owner (simplified check, usually done via data attributes)
    const postElement = button.closest('.post-card-premium');
    const isOwner = postElement?.dataset.isOwner === 'true';

    menu.innerHTML = `
        <div class="menu-item copy" onclick="copyPostLink('${postId}')">
            <i class="far fa-copy"></i> Copy Link
        </div>
        ${isOwner ? `
            <div class="menu-divider"></div>
            <div class="menu-item delete danger" onclick="window.showNotification ? window.showNotification('Delete feature coming soon!', 'info') : alert('Coming soon!')">
                <i class="far fa-trash-alt"></i> Delete <span style="font-size:10px; opacity:0.7;">(Soon)</span>
            </div>
        ` : ''}
    `;

    document.body.appendChild(menu);

    // Position menu near the button
    const rect = button.getBoundingClientRect();
    const menuWidth = 180;

    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.left = `${rect.right - menuWidth}px`;
    menu.style.width = `${menuWidth}px`;
    menu.style.zIndex = '1000';

    // Add active animation class
    setTimeout(() => menu.classList.add('active'), 10);
}

function closeAllMenus() {
    document.querySelectorAll('.post-options-menu').forEach(m => {
        m.classList.remove('active');
        setTimeout(() => m.remove(), 200);
    });
}

// Global actions
window.copyPostLink = (postId) => {
    const url = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(url).then(() => {
        if (window.showNotification) window.showNotification('Link copied to clipboard! 🔗', 'success');
        closeAllMenus();
    });
};

window.reportPost = (postId) => {
    if (window.showNotification) window.showNotification('Post reported. Thank you for making Sparkle safer! 🛡️', 'success');
    closeAllMenus();
};

window.confirmDeletePost = async (postId) => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) return;

    try {
        await window.DashboardAPI.deletePost(postId);
        if (window.showNotification) window.showNotification('Post deleted successfully', 'success');

        // Remove the post from the DOM
        const postEl = document.querySelector(`[data-post-id="${postId}"]`);
        if (postEl) {
            postEl.style.opacity = '0';
            postEl.style.transform = 'scale(0.95)';
            setTimeout(() => postEl.remove(), 300);
        }
        closeAllMenus();
    } catch (err) {
        console.error('Delete error:', err);
        if (window.showNotification) window.showNotification('Failed to delete post', 'error');
    }
};
