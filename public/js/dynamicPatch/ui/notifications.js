// notifications.js
import { timeAgo } from '../core/utils.js';

export function initNotifications() {
    initRealNotifications();
    initSparkleNotifications();
}

function initRealNotifications() {
    // Create notification container
    if (!document.getElementById('real-notification-container')) {
        const container = document.createElement('div');
        container.id = 'real-notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 999999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 350px;
            width: calc(100% - 40px);
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    // Override the existing showNotification function
    const originalShowNotification = window.showNotification;

    window.showNotification = function (message, type = 'info', duration = 4000) {
        // If message is an object (new premium style), handle as Sparkle Toast
        if (typeof message === 'object') {
            if (window.showNotificationToast) {
                window.showNotificationToast(message);
                return;
            }
            // Fallback to text
            message = message.content || message.message || 'Notification';
        }

        // Call original if it exists
        if (typeof originalShowNotification === 'function') {
            originalShowNotification(message, type);
        }

        showRealNotification(message, type, duration);
    };

    function showRealNotification(message, type = 'info', duration = 4000) {
        const container = document.getElementById('real-notification-container');
        if (!container) return;

        const colors = {
            success: { bg: '#4CAF50', icon: 'fa-check-circle' },
            error: { bg: '#f44336', icon: 'fa-exclamation-circle' },
            warning: { bg: '#ff9800', icon: 'fa-exclamation-triangle' },
            info: { bg: '#2196F3', icon: 'fa-info-circle' },
            spark: { bg: '#FF3D6D', icon: 'fa-fire' },
            follow: { bg: '#833AB4', icon: 'fa-user-plus' },
            comment: { bg: '#00BCD4', icon: 'fa-comment' },
            default: { bg: '#666', icon: 'fa-bell' }
        };

        const color = colors[type] || colors.default;

        const notification = document.createElement('div');
        notification.style.cssText = `
            background: white;
            border-left: 4px solid ${color.bg};
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
            padding: 12px 15px;
            display: flex;
            align-items: center;
            gap: 12px;
            transform: translateX(120%);
            animation: slideInNotification 0.3s ease forwards;
            cursor: pointer;
            pointer-events: auto;
            margin-bottom: 10px;
            position: relative;
            overflow: hidden;
            transition: transform 0.2s;
        `;

        notification.onmouseenter = () => { notification.style.transform = 'scale(1.02)'; };
        notification.onmouseleave = () => { notification.style.transform = 'scale(1)'; };

        const icon = document.createElement('div');
        icon.style.cssText = `
            width: 36px; height: 36px; border-radius: 50%;
            background: ${color.bg}20; display: flex; align-items: center;
            justify-content: center; color: ${color.bg}; font-size: 18px; flex-shrink: 0;
        `;
        icon.innerHTML = `<i class="fas ${color.icon}"></i>`;

        const messageEl = document.createElement('div');
        messageEl.style.cssText = `flex: 1; color: #333; font-size: 13px; line-height: 1.4; word-break: break-word;`;
        messageEl.textContent = message;

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.cssText = `background: none; border: none; color: #999; font-size: 18px; cursor: pointer; padding: 0 5px; transition: color 0.2s; flex-shrink: 0;`;
        closeBtn.onclick = (e) => { e.stopPropagation(); notification.remove(); };

        const progressBar = document.createElement('div');
        progressBar.style.cssText = `position: absolute; bottom: 0; left: 0; height: 3px; width: 100%; background: linear-gradient(90deg, ${color.bg}, ${color.bg}80); animation: progressBar ${duration}ms linear forwards;`;

        notification.appendChild(icon);
        notification.appendChild(messageEl);
        notification.appendChild(closeBtn);
        notification.appendChild(progressBar);

        notification.onclick = () => { notification.remove(); };

        container.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutNotification 0.3s ease forwards';
                setTimeout(() => notification.remove(), 300);
            }
        }, duration);
    }

    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInNotification { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideOutNotification { from { transform: translateX(0); opacity: 1; } to { transform: translateX(120%); opacity: 0; } }
        @keyframes progressBar { from { width: 100%; } to { width: 0%; } }
        @media (max-width: 768px) {
            #real-notification-container { top: 10px; right: 10px; left: 10px; max-width: none; width: auto; }
            #real-notification-container > div { padding: 10px 12px !important; margin-bottom: 8px !important; }
        }
    `;
    document.head.appendChild(style);

    window.showSuccess = (msg) => window.showNotification(msg, 'success');
    window.showError = (msg) => window.showNotification(msg, 'error');
    window.showWarning = (msg) => window.showNotification(msg, 'warning');
    window.showInfo = (msg) => window.showNotification(msg, 'info');
}

function initSparkleNotifications() {
    const styleEl = document.createElement('style');
    styleEl.id = 'sparkle-notif-styles';
    styleEl.textContent = `
        /* Notification Panel and Toast styles (as extracted from original) */
        #sparkle-notif-overlay { position: fixed; inset: 0; z-index: 99990; background: transparent; display: none; }
        #sparkle-notif-overlay.open { display: block; }
        #sparkle-notif-panel {
            position: fixed; top: 60px; right: 10px; width: 380px; max-width: calc(100vw - 20px);
            max-height: 85vh; background: #fff; border-radius: 16px;
            box-shadow: 0 8px 40px rgba(233,30,99,0.18), 0 2px 12px rgba(0,0,0,0.12);
            z-index: 99999; display: flex; flex-direction: column; overflow: hidden;
            transform: translateY(-10px) scale(0.97); opacity: 0;
            transition: transform 0.25s cubic-bezier(.4,0,.2,1), opacity 0.25s ease; pointer-events: none;
        }
        #sparkle-notif-panel.open { transform: translateY(0) scale(1); opacity: 1; pointer-events: all; }
        .sn-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px 12px; border-bottom: 1px solid #fce4ec; background: linear-gradient(135deg, #fff 60%, #fce4ec); }
        .sn-header h3 { font-size: 18px; font-weight: 700; color: #1e1e2e; margin: 0; }
        .sn-close-btn { width: 28px; height: 28px; border-radius: 50%; background: #f5f5f5; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #666; }
        .sn-list { flex: 1; overflow-y: auto; padding: 6px 0; }
        .sn-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; cursor: pointer; transition: background 0.2s; border-left: 3px solid transparent; }
        .sn-item.sn-unread { background: #fff0f5; border-left-color: #e91e63; }
        .sn-avatar { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; }
        .sn-time { font-size: 11px; color: #e91e63; margin-top: 3px; font-weight: 600; }
        
        #sparkle-toast-container { position: fixed; bottom: 20px; right: 20px; display: flex; flex-direction: column; gap: 10px; z-index: 999999; pointer-events: none; }
        .sn-toast { display: flex; align-items: center; gap: 12px; background: #fff; border-radius: 14px; padding: 12px 16px; box-shadow: 0 4px 24px rgba(233,30,99,0.18); border-left: 4px solid #e91e63; min-width: 280px; pointer-events: all; transform: translateX(110%); opacity: 0; transition: transform 0.35s ease; cursor: pointer; }
        .sn-toast.visible { transform: translateX(0); opacity: 1; }
        @keyframes bellRing { 0%,100% { transform: rotate(0); } 10% { transform: rotate(15deg); } 20% { transform: rotate(-15deg); } }
        #navBellIcon.ringing { animation: bellRing 0.7s ease; color: #e91e63; }
     `;
    document.head.appendChild(styleEl);

    window.toggleNotificationPanel = function () {
        const panel = document.getElementById('sparkle-notif-panel');
        if (!panel) return;
        panel.classList.toggle('open');
        document.getElementById('sparkle-notif-overlay')?.classList.toggle('open');
    };

    window.showNotificationToast = function (notification) {
        const container = document.getElementById('sparkle-toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'sn-toast';
        toast.innerHTML = `
            <div class="sn-toast-body">
                <div class="sn-toast-title">${notification.title || 'Notification'}</div>
                <div class="sn-toast-text">${notification.message || notification.content || ''}</div>
            </div>
        `;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('visible'));
        setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 400); }, 5000);
    };
}
