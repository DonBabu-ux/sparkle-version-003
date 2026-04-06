// sync.js

export function initSync() {
    // Poll for notifications every 30 seconds
    setInterval(async () => {
        try {
            const notifications = await window.DashboardAPI.loadNotifications({ unreadOnly: true });
            const unreadCount = notifications.filter(n => !n.is_read).length;
            updateNotificationBadges(unreadCount);

            notifications.forEach(notification => {
                const shownIds = JSON.parse(localStorage.getItem('shownNotifications') || '[]');
                if (!shownIds.includes(notification.id)) {
                    if (window.showNotification) {
                        window.showNotification(notification.content || 'New notification', {
                            type: notification.type || 'info',
                            title: notification.actor_name || 'Sparkle'
                        });
                    }
                    shownIds.push(notification.id);
                    localStorage.setItem('shownNotifications', JSON.stringify(shownIds.slice(-50)));
                }
            });
        } catch (e) {
            console.error('Sync error:', e);
        }
    }, 30000);
}

function updateNotificationBadges(count) {
    ['notificationCount', 'notificationCountBottom'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = count;
            el.style.display = count > 0 ? 'flex' : 'none';
        }
    });
}
