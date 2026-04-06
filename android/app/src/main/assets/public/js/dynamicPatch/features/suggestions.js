// suggestions.js - Handles Follower Suggestions interactions

export function initSuggestions() {
    const suggestionsList = document.querySelector('.suggestions-list');
    if (!suggestionsList) return;

    suggestionsList.addEventListener('click', async (e) => {
        const followBtn = e.target.closest('.follow-btn-suggestion');
        if (!followBtn) return;

        const userId = followBtn.dataset.userId;
        const originalText = followBtn.innerText;

        try {
            followBtn.disabled = true;
            followBtn.innerText = '...';

            const result = await window.DashboardAPI.followUser(userId);

            if (result.success || result.action === 'followed') {
                followBtn.innerText = 'Following';
                followBtn.style.color = 'var(--text-muted)';
                followBtn.style.cursor = 'default';
                followBtn.classList.remove('follow-btn-suggestion');
                if (window.showNotification) window.showNotification('Following! 🤝', 'success');
            } else {
                followBtn.innerText = originalText;
                followBtn.disabled = false;
            }
        } catch (err) {
            console.error('Follow failed:', err);
            followBtn.innerText = originalText;
            followBtn.disabled = false;
            if (window.showNotification) window.showNotification('Failed to follow', 'error');
        }
    });
}
