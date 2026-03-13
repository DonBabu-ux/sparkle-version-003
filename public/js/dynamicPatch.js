// dynamicPatch.js - Makes Dashboard Dynamic with Real API Data
// This script patches the existing script.js functions to use DashboardAPI

console.log('🚀 Loading Dynamic API Patch...');

// Global listener for image load errors to handle 403 Forbidden or broken links
window.addEventListener('error', (event) => {
    if (event.target.tagName === 'IMG' || event.target.tagName === 'VIDEO') {
        const el = event.target;
        const src = el.src || (el.querySelector('source') ? el.querySelector('source').src : '');

        // Handle specific CDN failures or 403/404 scenarios
        const isProblematic = src.includes('fbcdn.net') ||
            src.includes('fbsbx.com') ||
            src.includes('cloudinary.com') ||
            src.includes('avatar') ||
            el.classList.contains('avatar') ||
            el.classList.contains('user-avatar') ||
            el.classList.contains('story-media-bg');

        if (isProblematic) {
            if (el.dataset.fallbackApplied) return;
            el.dataset.fallbackApplied = 'true';

            console.warn('⚠️ Media failed to load, applying fallback:', src);

            if (el.tagName === 'IMG') {
                el.src = '/uploads/avatars/default.png';
                el.classList.add('fallback-media');
            } else if (el.tagName === 'VIDEO') {
                // For videos in stories/feed, show an overlay if possible
                const wrapper = el.closest('.video-wrapper') || el.closest('.story-media-container') || el.closest('.story-view-card');
                if (wrapper) {
                    const overlay = document.createElement('div');
                    overlay.className = 'media-error-overlay';
                    overlay.style.cssText = `
                        position: absolute; inset: 0; background: rgba(0,0,0,0.8);
                        display: flex; flex-direction: column; align-items: center;
                        justify-content: center; color: white; z-index: 10; font-size: 12px;
                        padding: 10px; text-align: center;
                    `;
                    overlay.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: #FF3D6D; margin-bottom: 5px;"></i> media error`;
                    wrapper.appendChild(overlay);
                }
                el.style.display = 'none';
            }
        }
    }
}, true);

// ============ MOBILE RESPONSIVENESS FIXES ============
(function fixMobileVisibility() {
    const style = document.createElement('style');
    style.textContent = `
        /* Mobile responsive adjustments */
        @media (max-width: 768px) {
            /* FAB button */
            #globalCreateBtn {
                width: 50px !important;
                height: 50px !important;
                bottom: 70px !important;
                right: 15px !important;
                font-size: 20px !important;
                box-shadow: 0 4px 15px rgba(255, 61, 109, 0.4) !important;
            }
            
            /* Modals */
            .modal-content {
                width: 95% !important;
                max-width: 95% !important;
                margin: 10px auto !important;
                border-radius: 15px !important;
                max-height: 85vh !important;
                overflow-y: auto !important;
                background: #ffffff !important;
            }
            
            .modal[style*="align-items: flex-end"] .modal-content {
                border-radius: 20px 20px 0 0 !important;
                padding-bottom: 20px !important;
                margin: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
            }
            
            /* Create option cards */
            .create-option-card {
                padding: 12px 5px !important;
                background: #ffffff !important;
                border: 1px solid #f0f0f0 !important;
            }
            
            .create-option-card div:first-child {
                width: 40px !important;
                height: 40px !important;
                font-size: 18px !important;
                margin-bottom: 8px !important;
            }
            
            .create-option-card div:nth-child(2) {
                font-size: 12px !important;
                color: #1976d2 !important;
            }
            
            .create-option-card div:last-child {
                font-size: 9px !important;
                color: #555 !important;
            }
            
            /* Grid layouts */
            .grid-3, [style*="grid-template-columns: repeat(3, 1fr)"] {
                grid-template-columns: repeat(2, 1fr) !important;
                gap: 8px !important;
            }
            
            /* Post cards */
            .post-card {
                margin: 8px !important;
                padding: 12px !important;
                background: #ffffff !important;
            }
            
            .post-header {
                flex-wrap: wrap !important;
            }
            
            .post-avatar {
                width: 35px !important;
                height: 35px !important;
            }
            
            .post-username {
                font-size: 13px !important;
                color: #000 !important;
            }
            
            .post-time, .post-campus {
                font-size: 10px !important;
                color: #666 !important;
            }
            
            .post-caption {
                font-size: 13px !important;
                color: #333 !important;
            }
            
            /* Navigation */
            .nav-item span {
                display: none !important;
            }
            
            .nav-item i {
                font-size: 20px !important;
                margin: 0 !important;
                color: #666 !important;
            }
            
            .nav-item.active i {
                color: var(--primary, #FF3D6D) !important;
            }
            
            .nav-item {
                padding: 10px !important;
            }
            
            /* Connect cards */
            .connect-card-inner {
                flex-direction: column !important;
                text-align: center !important;
                padding: 15px !important;
            }
            
            .connect-avatar-container {
                margin: 0 auto 10px !important;
            }
            
            .connect-avatar {
                width: 60px !important;
                height: 60px !important;
            }
            
            .connect-info {
                text-align: center !important;
            }
            
            .connect-name {
                font-size: 14px !important;
                color: #000 !important;
            }
            
            .connect-campus, .connect-bio {
                font-size: 11px !important;
                color: #666 !important;
            }
            
            .connect-actions {
                margin-top: 10px !important;
                display: flex !important;
                gap: 8px !important;
                justify-content: center !important;
            }
            
            .connect-actions button {
                padding: 6px 12px !important;
                font-size: 11px !important;
            }
            
            /* Marketplace cards */
            .market-card {
                margin-bottom: 10px !important;
            }
            
            .market-card div[style*="height: 150px"] {
                height: 120px !important;
            }
            
            .market-card div[style*="font-weight: bold; font-size: 14px"] {
                font-size: 13px !important;
                color: #333 !important;
            }
            
            .market-card div[style*="color: var(--primary"] {
                font-size: 14px !important;
            }
            
            /* Stories */
            .story-view-card {
                min-width: 60px !important;
            }
            
            .story-avatar {
                width: 40px !important;
                height: 40px !important;
            }
            
            .story-username {
                font-size: 9px !important;
                color: #333 !important;
            }
            
            .story-time {
                font-size: 8px !important;
                color: #666 !important;
            }
            
            /* Profile page */
            .profile-header {
                flex-direction: column !important;
                text-align: center !important;
                padding: 15px !important;
            }
            
            .profile-avatar {
                width: 80px !important;
                height: 80px !important;
                margin: 0 auto 10px !important;
            }
            
            .profile-stats {
                justify-content: center !important;
                gap: 15px !important;
            }
            
            .profile-stats div {
                color: #333 !important;
            }
            
            .profile-stats div:first-child {
                font-weight: bold !important;
                color: #000 !important;
            }
            
            /* Modal footers */
            .modal-footer {
                flex-direction: column !important;
                gap: 8px !important;
            }
            
            .modal-footer button,
            .modal-footer .btn {
                width: 100% !important;
                margin: 0 !important;
            }
            
            /* Chat modal */
            .modal-content[style*="height: 80vh"] {
                height: 90vh !important;
            }
            
            #chatMessages {
                padding: 10px !important;
            }
            
            #chatMessages div[style*="background: linear-gradient"] {
                max-width: 85% !important;
            }
            
            /* Input fields */
            input, textarea, select, .form-control {
                font-size: 16px !important;
                padding: 10px !important;
                color: #333 !important;
                background: #fff !important;
                border: 1px solid #ddd !important;
            }
            
            /* Buttons */
            .btn {
                padding: 10px 15px !important;
                font-size: 13px !important;
                color: #fff !important;
            }
            
            .btn-primary {
                background: var(--primary, #FF3D6D) !important;
            }
            
            .btn-secondary {
                background: #6c757d !important;
            }
            
            /* Notification container */
            #notification-popup-container,
            #real-notification-container {
                top: 10px !important;
                right: 10px !important;
                left: 10px !important;
                max-width: none !important;
            }
            
            /* Polls */
            .poll-question {
                font-size: 14px !important;
                color: #000 !important;
            }
            
            .poll-option-text {
                font-size: 12px !important;
                color: #333 !important;
            }
            
            .poll-footer {
                font-size: 11px !important;
                color: #666 !important;
            }
            
            /* Groups */
            .group-card {
                padding: 10px !important;
            }
            
            .group-card div[style*="font-weight: 600"] {
                font-size: 14px !important;
                color: #000 !important;
            }
            
            .group-card div[style*="font-size: 12px"] {
                font-size: 11px !important;
                color: #666 !important;
            }
            
            /* Events */
            .event-card h3 {
                font-size: 14px !important;
                color: #000 !important;
            }
            
            .event-card div[style*="font-size: 12px"] {
                font-size: 11px !important;
                color: #666 !important;
            }
            
            /* Lost & Found */
            .lost-card div[style*="font-weight: 600"] {
                font-size: 13px !important;
                color: #000 !important;
            }
            
            .badge {
                font-size: 10px !important;
                color: #fff !important;
            }
            
            /* Skills */
            .skill-card div[style*="font-weight: 600"] {
                font-size: 13px !important;
                color: #000 !important;
            }
            
            .skill-card div[style*="color: #888"] {
                font-size: 10px !important;
                color: #666 !important;
            }
            
            /* Tables if any */
            table {
                display: block !important;
                overflow-x: auto !important;
            }
            
            /* Ensure proper spacing */
            .main-content {
                padding: 10px !important;
            }
            
            .sidebar {
                padding: 10px 5px !important;
            }
            
            /* Fix modals with forms */
            .modal-body .form-group {
                margin-bottom: 12px !important;
            }
            
            .modal-body label {
                font-size: 12px !important;
                color: #333 !important;
                margin-bottom: 4px !important;
                display: block !important;
            }
        }
        
        /* Extra small devices */
        @media (max-width: 480px) {
            .grid-3, [style*="grid-template-columns: repeat(3, 1fr)"] {
                grid-template-columns: 1fr !important;
            }
            
            .create-option-card {
                padding: 10px 3px !important;
            }
            
            .post-actions {
                flex-wrap: wrap !important;
                gap: 5px !important;
            }
            
            .action-btn {
                padding: 6px 10px !important;
                font-size: 11px !important;
                color: #666 !important;
            }
            
            .action-btn.active {
                color: var(--primary, #FF3D6D) !important;
            }
            
            .profile-stats {
                gap: 10px !important;
            }
            
            .profile-stats div {
                font-size: 12px !important;
            }
            
            .profile-stats div:first-child {
                font-size: 16px !important;
            }
            
            .post-caption-username {
                font-size: 12px !important;
            }
            
            .spark-count {
                font-size: 11px !important;
            }
        }
        
        /* Fix for very small devices */
        @media (max-width: 360px) {
            .create-option-card div:first-child {
                width: 35px !important;
                height: 35px !important;
                font-size: 16px !important;
            }
            
            .create-option-card div:nth-child(2) {
                font-size: 11px !important;
            }
            
            .create-option-card div:last-child {
                font-size: 8px !important;
            }
            
            .story-view-card {
                min-width: 50px !important;
            }
            
            .story-avatar {
                width: 35px !important;
                height: 35px !important;
            }
        }
        
        /* Dark text fixes for all elements */
        .text-muted, .text-secondary, .text-grey {
            color: #666 !important;
        }
        
        .text-primary {
            color: var(--primary, #FF3D6D) !important;
        }
        
        .text-success {
            color: #4CAF50 !important;
        }
        
        .text-danger {
            color: #f44336 !important;
        }
        
        .text-warning {
            color: #ff9800 !important;
        }
        
        .text-info {
            color: #2196F3 !important;
        }
        
        /* Fix any potential white text */
        [style*="color: white"], [style*="color:#fff"], [style*="color: #fff"] {
            color: #333 !important;
        }
        
        /* Buttons with white text should stay white */
        .btn[style*="color: white"], 
        .btn[style*="color:#fff"], 
        .btn[style*="color: #fff"],
        button[style*="color: white"],
        button[style*="color:#fff"],
        button[style*="color: #fff"] {
            color: white !important;
        }
        
        /* Fix modal backgrounds */
        .modal-content {
            background: #ffffff !important;
        }
        
        .modal-header {
            border-bottom: 1px solid #eee !important;
        }
        
        .modal-header .modal-title {
            color: #000 !important;
        }
        
        .modal-body {
            background: #ffffff !important;
        }
        
        .modal-footer {
            border-top: 1px solid #eee !important;
            background: #f9f9f9 !important;
        }
        
        /* Fix dropdowns */
        .dropdown-menu {
            background: #ffffff !important;
            border: 1px solid #ddd !important;
        }
        
        .dropdown-item {
            color: #333 !important;
        }
        
        .dropdown-item:hover {
            background: #f5f5f5 !important;
        }
        
        /* Fix notifications */
        .notification-item {
            background: #ffffff !important;
        }
        
        .notification-item.unread {
            background: #f0f7ff !important;
        }
        
        .notification-item div[style*="font-size: 13px"] {
            color: #333 !important;
        }
        
        .notification-item div[style*="font-size: 11px"] {
            color: #999 !important;
        }
        
        /* Fix conversation items */
        .conversation-item-premium {
            background: #ffffff !important;
        }
        
        .conversation-item-premium.active {
            background: #f0f7ff !important;
        }
        
        .conversation-item-premium div[style*="font-weight: 600"] {
            color: #000 !important;
        }
        
        .conversation-item-premium div[style*="color: #666"] {
            color: #666 !important;
        }
    `;
    document.head.appendChild(style);
})();

// ============ REAL NOTIFICATION POPUPS ============
(function initRealNotifications() {
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
        // Call original if it exists
        if (typeof originalShowNotification === 'function') {
            originalShowNotification(message, type);
        }

        showRealNotification(message, type, duration);
    };

    function showRealNotification(message, type = 'info', duration = 4000) {
        const container = document.getElementById('real-notification-container');
        if (!container) return;

        // Define colors based on type
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

        // Create notification element
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

        // Add hover effect
        notification.onmouseenter = () => {
            notification.style.transform = 'scale(1.02)';
        };
        notification.onmouseleave = () => {
            notification.style.transform = 'scale(1)';
        };

        // Icon
        const icon = document.createElement('div');
        icon.style.cssText = `
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: ${color.bg}20;
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${color.bg};
            font-size: 18px;
            flex-shrink: 0;
        `;
        icon.innerHTML = `<i class="fas ${color.icon}"></i>`;

        // Message
        const messageEl = document.createElement('div');
        messageEl.style.cssText = `
            flex: 1;
            color: #333;
            font-size: 13px;
            line-height: 1.4;
            word-break: break-word;
        `;
        messageEl.textContent = message;

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: #999;
            font-size: 18px;
            cursor: pointer;
            padding: 0 5px;
            transition: color 0.2s;
            flex-shrink: 0;
        `;
        closeBtn.onmouseenter = () => {
            closeBtn.style.color = '#666';
        };
        closeBtn.onmouseleave = () => {
            closeBtn.style.color = '#999';
        };
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            notification.remove();
        };

        // Progress bar
        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            height: 3px;
            width: 100%;
            background: linear-gradient(90deg, ${color.bg}, ${color.bg}80);
            animation: progressBar ${duration}ms linear forwards;
        `;

        notification.appendChild(icon);
        notification.appendChild(messageEl);
        notification.appendChild(closeBtn);
        notification.appendChild(progressBar);

        // Add click handler
        notification.onclick = () => {
            notification.remove();
        };

        container.appendChild(notification);

        // Auto remove after duration
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutNotification 0.3s ease forwards';
                setTimeout(() => notification.remove(), 300);
            }
        }, duration);
    }

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInNotification {
            from {
                transform: translateX(120%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutNotification {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(120%);
                opacity: 0;
            }
        }
        
        @keyframes progressBar {
            from { width: 100%; }
            to { width: 0%; }
        }
        
        @media (max-width: 768px) {
            #real-notification-container {
                top: 10px;
                right: 10px;
                left: 10px;
                max-width: none;
                width: auto;
            }
            
            #real-notification-container > div {
                padding: 10px 12px !important;
                margin-bottom: 8px !important;
            }
            
            #real-notification-container > div div:first-child {
                width: 32px !important;
                height: 32px !important;
                font-size: 16px !important;
            }
            
            #real-notification-container > div div:nth-child(2) {
                font-size: 12px !important;
            }
        }
    `;
    document.head.appendChild(style);

    // Helper functions
    window.showSuccess = (msg) => window.showNotification(msg, 'success');
    window.showError = (msg) => window.showNotification(msg, 'error');
    window.showWarning = (msg) => window.showNotification(msg, 'warning');
    window.showInfo = (msg) => window.showNotification(msg, 'info');
})();

// ============ INJECT CREATE BUTTON (FAB) ============
function injectCreateButton() {
    if (document.getElementById('globalCreateBtn')) return;

    const fab = document.createElement('div');
    fab.id = 'globalCreateBtn';
    fab.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 60px;
        height: 60px;
        background: linear-gradient(45deg, var(--primary, #FF3D6D), var(--secondary, #833AB4));
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 24px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        cursor: pointer;
        z-index: 9999;
        transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    fab.innerHTML = '<i class="fas fa-plus"></i>';
    fab.onmouseover = () => fab.style.transform = 'scale(1.1)';
    fab.onmouseout = () => fab.style.transform = 'scale(1)';
    fab.onclick = showCreateOptions;

    document.body.appendChild(fab);
}

window.showCreateOptions = function showCreateOptions() {
    const isMobile = window.innerWidth <= 768;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
        display: flex;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(5px);
        z-index: 10000;
        align-items: ${isMobile ? 'flex-end' : 'center'};
        justify-content: center;
    `;

    modal.innerHTML = `
        <div class="modal-content" style="
            width: 100%; 
            max-width: ${isMobile ? '100%' : '500px'}; 
            background: white;
            border-radius: ${isMobile ? '20px 20px 0 0' : '20px'}; 
            margin: 0; 
            animation: slideUp 0.3s ease;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
        ">
            <div style="text-align:center; padding: 15px; border-bottom:1px solid #eee; margin-bottom:15px;">
                ${isMobile ? '<div style="width: 40px; height: 4px; background: #ddd; border-radius: 2px; margin: 0 auto;"></div>' : ''}
                <div style="font-size: 16px; font-weight: 600; color: #333; margin-top: ${isMobile ? '8px' : '10px'};">Create Something Amazing</div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 0 20px 20px;">
                <div id="newPostOption" class="create-option-card" style="
                    background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
                    padding: 20px 10px;
                    border-radius: 16px;
                    text-align: center;
                    cursor: pointer;
                    border: 2px solid transparent;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                ">
                    <div style="width: 50px; height: 50px; background: #2196f3; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 22px; box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3); transition: transform 0.3s;">
                        <i class="fas fa-pen"></i>
                    </div>
                    <div style="font-weight: 700; font-size: 14px; color: #1976d2; margin-bottom: 4px;">Post</div>
                    <div style="font-size: 10px; color: #555;">Share text or image</div>
                </div>
                <div id="newMomentOption" class="create-option-card" style="
                    background: linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%);
                    padding: 20px 10px;
                    border-radius: 16px;
                    text-align: center;
                    cursor: pointer;
                    border: 2px solid transparent;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                ">
                    <div style="width: 50px; height: 50px; background: #e91e63; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 22px; box-shadow: 0 4px 12px rgba(233, 30, 99, 0.3); transition: transform 0.3s;">
                        <i class="fas fa-video"></i>
                    </div>
                    <div style="font-weight: 700; font-size: 14px; color: #c2185b; margin-bottom: 4px;">Moment</div>
                    <div style="font-size: 10px; color: #555;">Share a short video</div>
                </div>
                <div id="newAfterglowOption" class="create-option-card" style="
                    background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%);
                    padding: 20px 10px;
                    border-radius: 16px;
                    text-align: center;
                    cursor: pointer;
                    border: 2px solid transparent;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                ">
                    <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #9c27b0, #e91e63); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 22px; box-shadow: 0 4px 12px rgba(156, 39, 176, 0.4); transition: transform 0.3s;">
                        <i class="fas fa-bolt"></i>
                    </div>
                    <div style="font-weight: 700; font-size: 14px; color: #7b1fa2; margin-bottom: 4px;">AfterGlow</div>
                    <div style="font-size: 10px; color: #555;">Share a 24hr story</div>
                </div>
            </div>
            <button class="btn btn-block" style="background: none; color: #666; padding: 15px; border: none; font-size: 15px; cursor: pointer; transition: color 0.2s; border-top: 1px solid #eee;" id="cancelCreate">Cancel</button>
        </div>
        <style>
            @keyframes slideUp { 
                from { transform: translateY(100%); opacity: 0; } 
                to { transform: translateY(0); opacity: 1; } 
            }
            .create-option-card:hover {
                transform: translateY(-4px);
                border-color: rgba(156, 39, 176, 0.3);
                box-shadow: 0 8px 20px rgba(0,0,0,0.12);
            }
            .create-option-card:hover > div:first-child {
                transform: scale(1.1);
            }
            .create-option-card:active {
                transform: translateY(-2px);
            }
            #cancelCreate:hover {
                color: #333;
            }
        </style>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#newPostOption').onclick = () => {
        modal.remove();
        const createModal = document.getElementById('createModal');
        if (createModal) {
            createModal.style.display = 'flex';
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            document.getElementById('postCaption')?.focus();
        }
    };

    modal.querySelector('#newMomentOption').onclick = () => {
        modal.remove();
        const momentModal = document.getElementById('momentModal');
        if (momentModal) {
            momentModal.style.display = 'flex';
        } else {
            window.uploadMoment();
        }
    };

    modal.querySelector('#newAfterglowOption').onclick = () => {
        modal.remove();
        const afterglowModal = document.getElementById('afterglowModal');
        if (afterglowModal) {
            afterglowModal.style.display = 'flex';
        } else {
            window.uploadAfterglowMedia();
        }
    };

    modal.querySelector('#cancelCreate').onclick = () => {
        modal.remove();
    };

    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    };
};

// Wait for DOM and DashboardAPI to be ready
document.addEventListener('DOMContentLoaded', async function () {
    setTimeout(async () => {
        console.log('🎯 Applying Dynamic Data Patch...');
        injectCreateButton();

        const currentToken = localStorage.getItem('sparkleToken');
        const currentUserData = JSON.parse(localStorage.getItem('sparkleUser') || localStorage.getItem('currentUser') || '{}');
        const currentUserId = currentUserData.id || currentUserData.user_id || '';
        const currentUsername = currentUserData.username || '';
        const currentCampus = currentUserData.campus || localStorage.getItem('sparkleUserCampus') || 'Sparkle Central';

        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        // ============ UPLOAD MOMENT LOGIC ============
        window.uploadMoment = function () {
            const modal = document.createElement('div');
            modal.className = 'modal premium-modal';
            modal.style.display = 'flex';
            modal.style.zIndex = '10001';

            modal.innerHTML = `
                <div class="modal-content premium-modal-content" style="max-width: 450px; animation: slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                    <div class="modal-header premium-modal-header">
                        <div class="modal-title premium-modal-title">
                            <i class="fas fa-video text-primary"></i> Share a Moment
                        </div>
                        <button class="close-modal premium-close-btn">&times;</button>
                    </div>
                    <div class="modal-body premium-modal-body">
                        <div class="media-upload-section" style="margin-bottom: 20px;">
                            <div class="media-upload-container" id="momentUploadArea" style="aspect-ratio: 9/16; max-height: 300px; overflow: hidden; position: relative; border: 2px dashed rgba(255, 61, 109, 0.3); border-radius: 15px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255, 61, 109, 0.02); transition: all 0.3s ease;">
                                <div class="upload-placeholder" id="momentPlaceholder">
                                    <div class="upload-icon-circle" style="width: 60px; height: 60px; background: rgba(255, 61, 109, 0.1); color: var(--primary, #FF3D6D); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; font-size: 24px;">
                                        <i class="fas fa-clapperboard"></i>
                                    </div>
                                    <div class="upload-text" style="text-align: center;">
                                        <span class="main-text" style="display: block; font-weight: 600; color: #333;">Select Short Video</span>
                                        <span class="sub-text" style="display: block; font-size: 12px; color: #777;">Up to 30 seconds</span>
                                    </div>
                                </div>
                                <video id="momentPreview" style="display: none; width: 100%; height: 100%; object-fit: cover; border-radius: 12px;" controls muted></video>
                                <input type="file" id="momentVideo" accept="video/*" style="display: none;">
                            </div>
                        </div>

                        <div class="post-input-section" style="margin-bottom: 20px;">
                            <textarea class="post-textarea" id="momentCaption" rows="2" 
                                placeholder="Write a catchy caption..." 
                                style="width: 100%; border: 1px solid #eee; border-radius: 12px; padding: 12px; font-family: inherit; resize: none; outline: none; transition: border-color 0.3s;"
                                onfocus="this.style.borderColor='var(--primary)'" 
                                onblur="this.style.borderColor='#eee'"></textarea>
                        </div>

                        <div id="uploadProgressContainer" style="display: none; margin-bottom: 15px;">
                            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px;">
                                <span id="uploadStatusText" style="color: #666;">Ready to upload</span>
                                <span id="uploadPercentage" style="font-weight: 600; color: var(--primary);">0%</span>
                            </div>
                            <div style="height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden;">
                                <div id="uploadProgressBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, var(--primary, #FF3D6D), var(--secondary, #833AB4)); transition: width 0.3s ease;"></div>
                            </div>
                        </div>
                        
                        <button class="btn-premium-submit" id="uploadMomentBtn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; background: var(--primary); color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer;">
                            <span>Share Moment</span>
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const closeBtn = modal.querySelector('.close-modal');
            const submitBtn = modal.querySelector('#uploadMomentBtn');
            const fileInput = modal.querySelector('#momentVideo');
            const uploadArea = modal.querySelector('#momentUploadArea');
            const preview = modal.querySelector('#momentPreview');
            const placeholder = modal.querySelector('#momentPlaceholder');
            const captionInput = modal.querySelector('#momentCaption');
            const progressContainer = modal.querySelector('#uploadProgressContainer');
            const statusText = modal.querySelector('#uploadStatusText');
            const progressBar = modal.querySelector('#uploadProgressBar');
            const percentageText = modal.querySelector('#uploadPercentage');

            uploadArea.onclick = () => fileInput.click();

            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (!file.type.startsWith('video/')) {
                        showNotification('Please select a video file', 'error');
                        fileInput.value = '';
                        return;
                    }

                    const url = URL.createObjectURL(file);
                    preview.src = url;
                    preview.style.display = 'block';
                    placeholder.style.display = 'none';
                    uploadArea.style.borderStyle = 'solid';
                    uploadArea.style.borderColor = 'rgba(255, 61, 109, 0.5)';
                }
            };

            const closeModal = () => {
                modal.classList.add('fade-out');
                setTimeout(() => { if (modal.parentNode) document.body.removeChild(modal); }, 300);
            };

            closeBtn.onclick = closeModal;
            modal.onclick = (e) => { if (e.target === modal) closeModal(); };

            submitBtn.onclick = async () => {
                const file = fileInput.files[0];
                if (!file) {
                    showNotification('Please select a video', 'error');
                    return;
                }

                try {
                    submitBtn.disabled = true;
                    submitBtn.style.opacity = '0.7';
                    submitBtn.innerHTML = '<span>Processing...</span> <i class="fas fa-spinner fa-spin"></i>';

                    progressContainer.style.display = 'block';
                    statusText.textContent = 'Uploading Moment...';

                    let progress = 0;
                    const progressInterval = setInterval(() => {
                        if (progress < 90) {
                            progress += Math.random() * 5;
                            const displayProgress = Math.min(Math.round(progress), 90);
                            progressBar.style.width = displayProgress + '%';
                            percentageText.textContent = displayProgress + '%';
                        }
                    }, 500);

                    await DashboardAPI.createMoment({
                        media: file,
                        caption: captionInput.value
                    });

                    clearInterval(progressInterval);
                    progressBar.style.width = '100%';
                    percentageText.textContent = '100%';
                    statusText.textContent = 'Shared successfully!';

                    showNotification('Moment shared successfully!', 'success');

                    setTimeout(() => {
                        closeModal();
                        if (window.loadMoments) loadMoments();
                        if (window.loadAfterglowStories) loadAfterglowStories();
                    }, 1000);

                } catch (error) {
                    console.error('Upload failed:', error);
                    statusText.textContent = 'Upload failed';
                    statusText.style.color = '#ff4757';
                    progressBar.style.background = '#ff4757';
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.innerHTML = '<span>Try Again</span> <i class="fas fa-redo"></i>';
                    showNotification('Failed to share moment', 'error');
                }
            };
        };

        console.log('📱 Current Token in localStorage:', currentToken ? currentToken.substring(0, 10) + '...' : 'NONE');
        console.log('👤 Current User:', currentUsername, currentUserId);

        DashboardAPI.token = currentToken;

        // ============ PROFILE UPDATE LOGIC ============
        window.saveProfileChanges = async function () {
            const nameInput = document.getElementById('editName');
            const bioInput = document.getElementById('editBio');
            const campusInput = document.getElementById('editCampus');
            const majorInput = document.getElementById('editMajor');

            if (!nameInput?.value || !campusInput?.value || !majorInput?.value) {
                showNotification('Please fill in all fields', 'warning');
                return;
            }

            const profileData = {
                name: nameInput.value,
                bio: bioInput.value || '',
                campus: campusInput.value,
                major: majorInput.value,
                avatar_url: currentUserData.avatar || '/uploads/avatars/default.png'
            };

            try {
                showNotification('Saving profile...', 'info');
                await DashboardAPI.updateProfile(profileData);

                currentUserData.name = profileData.name;
                localStorage.setItem('currentUser', JSON.stringify(currentUserData));

                showNotification('Profile updated!', 'success');
                if (typeof hideModal === 'function') {
                    hideModal('settingsModal');
                } else {
                    document.getElementById('settingsModal').classList.remove('active');
                    document.getElementById('settingsModal').style.display = 'none';
                }
                updateProfileDisplay();
            } catch (err) {
                showNotification('Failed to update profile', 'error');
            }
        };

        const saveSettingsBtn = document.querySelector('#settingsModal .btn-primary');
        if (saveSettingsBtn) {
            saveSettingsBtn.onclick = (e) => {
                e.preventDefault();
                saveProfileChanges();
            };
        }

        // ============ SYNC GLOBAL STATE ============
        if (typeof appState !== 'undefined') {
            console.log('🔄 Syncing global appState with real user data...');
            if (!appState.currentUser) {
                appState.currentUser = { id: '', username: '', name: '' };
            }

            appState.currentUser.id = currentUserId || 'guest';
            appState.currentUser.username = currentUsername || 'Guest';
            appState.currentUser.name = (currentUserData && currentUserData.name) || currentUsername || 'Guest User';

            if (typeof updateProfileDisplay === 'function') {
                updateProfileDisplay();
            }
        }

        // ============ OVERRIDE PROFILE DISPLAY ============
        window.updateProfileDisplay = async function () {
            console.log('🔄 Updating Profile Display with real data...');
            try {
                const profile = await DashboardAPI.loadUserProfile(currentUserId);

                const sidebarName = document.querySelector('.profile-info h3');
                const sidebarUsername = document.querySelector('.profile-info p');
                const sidebarAvatar = document.querySelector('.profile-image img');

                if (sidebarName) sidebarName.textContent = profile.name;
                if (sidebarUsername) sidebarUsername.textContent = `@${profile.username}`;
                if (sidebarAvatar) sidebarAvatar.src = profile.avatar;

                const profileName = document.getElementById('profileName');
                const profileBio = document.getElementById('profileBio');
                const profileAvatar = document.querySelector('.profile-header .profile-avatar img');
                const followersCount = document.getElementById('followersCount');
                const followingCount = document.getElementById('followingCount');

                if (profileName) profileName.textContent = profile.name;
                if (profileBio) profileBio.textContent = profile.bio || 'No bio yet.';
                if (profileAvatar) profileAvatar.src = profile.avatar;

                const [followers, following] = await Promise.all([
                    DashboardAPI.loadFollowers(currentUserId),
                    DashboardAPI.loadFollowing(currentUserId)
                ]);
                if (followersCount) followersCount.textContent = followers.length || 0;
                if (followingCount) followingCount.textContent = following.length || 0;

            } catch (err) {
                console.error('Failed to sync profile display:', err);
                showNotification('Failed to load profile', 'error');
            }
        };

        // ============ OVERRIDE PROFILE TABS ============
        window.switchProfileTab = async function (tab) {
            const container = document.getElementById('profileGrid');
            if (!container) return;

            document.querySelectorAll('.profile-tab').forEach(t => {
                t.classList.remove('active');
                if (t.dataset.tab === tab) t.classList.add('active');
            });

            container.innerHTML = '<div style="grid-column: span 3; text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

            if (tab === 'posts') {
                try {
                    const posts = await DashboardAPI.loadUserPosts(currentUserId);
                    container.innerHTML = '';

                    if (posts.length === 0) {
                        container.innerHTML = `
                            <div class="premium-empty-state" style="grid-column: span 3; width: 100%;">
                                <div class="empty-icon-container">
                                    <i class="fas fa-camera"></i>
                                </div>
                                <h3>No posts yet</h3>
                                <p>Share your first post with your campus!</p>
                            </div>
                        `;
                        return;
                    }

                    posts.forEach(post => {
                        const postEl = document.createElement('div');
                        postEl.style = "aspect-ratio: 1; overflow: hidden; position: relative; cursor: pointer; border-radius: 4px; background: #eee;";
                        postEl.innerHTML = post.media
                            ? `<img src="${post.media}" style="width: 100%; height: 100%; object-fit: cover;">`
                            : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--primary), var(--campus-purple)); color: white; padding: 10px; font-size: 14px; text-align: center;">${post.caption}</div>`;

                        postEl.addEventListener('click', () => {
                            showNotification(`View post: ${post.caption}`, 'info');
                        });
                        container.appendChild(postEl);
                    });

                } catch (error) {
                    console.error('Failed to load user posts:', error);
                    container.innerHTML = '<div style="color: red; padding: 20px;">Failed to load posts</div>';
                    showNotification('Failed to load posts', 'error');
                }
            } else if (tab === 'moments') {
                try {
                    container.innerHTML = '<div style="grid-column: span 3; text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Loading moments...</div>';
                    const moments = await window.loadUserMoments(currentUserId);

                    container.innerHTML = '';
                    if (moments.length === 0) {
                        container.innerHTML = `
                            <div style="grid-column: span 3; text-align: center; padding: 40px 20px; color: #999;">
                                <i class="fas fa-video" style="font-size: 50px; margin-bottom: 15px;"></i>
                                <h3 style="color: #333;">No moments yet</h3>
                                <p style="color: #666;">Share short videos to specific moments!</p>
                                <button class="btn btn-primary" style="margin-top: 15px;" onclick="uploadMoment()">
                                    <i class="fas fa-plus"></i> Create Moment
                                </button>
                            </div>
                        `;
                        return;
                    }

                    moments.forEach(m => {
                        const el = document.createElement('div');
                        el.style = "aspect-ratio: 9/16; overflow: hidden; position: relative; cursor: pointer; border-radius: 8px; background: #000;";
                        el.innerHTML = `
                            <video src="${m.media}" style="width:100%; height:100%; object-fit:cover;"></video>
                            <div style="position:absolute; bottom:0; left:0; width:100%; padding:10px; background:linear-gradient(to top, rgba(0,0,0,0.8), transparent); color:white; font-size:12px;">
                                <i class="fas fa-play"></i> ${m.caption || 'Moment'}
                            </div>
                        `;
                        el.onclick = () => {
                            const vModal = document.createElement('div');
                            vModal.className = 'modal';
                            vModal.style.display = 'flex';
                            vModal.style.background = 'black';
                            vModal.innerHTML = `
                                <button class="close-modal" style="color:white; position:absolute; top:20px; right:20px; z-index:10;">&times;</button>
                                <video src="${m.media}" controls autoplay style="max-width:100%; max-height:100vh; margin:auto;"></video>
                            `;
                            document.body.appendChild(vModal);
                            vModal.querySelector('.close-modal').onclick = () => vModal.remove();
                        };
                        container.appendChild(el);
                    });

                } catch (e) {
                    console.error(e);
                    container.innerHTML = '<div style="color:red; text-align:center;">Failed to load moments.</div>';
                    showNotification('Failed to load moments', 'error');
                }
            } else if (tab === 'saved') {
                container.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #999;">
                        <i class="fas fa-bookmark" style="font-size: 50px; margin-bottom: 15px;"></i>
                        <h3 style="color: #333;">Saved Posts</h3>
                        <p style="color: #666;">Posts you save will appear here</p>
                    </div>
                `;
            }
        };

        window.loadUserMoments = async function (userId) {
            try {
                if (DashboardAPI.loadUserMoments) {
                    return await DashboardAPI.loadUserMoments(userId);
                }
                const posts = await DashboardAPI.loadUserPosts(userId);
                return posts.filter(p => p.media && (p.media.endsWith('.mp4') || p.media.includes('video')));
            } catch (e) {
                console.error('Failed to load user moments', e);
                return [];
            }
        };

        // ============ NOTIFICATIONS INTEGRATION ============
        window.loadNotifications = async function () {
            console.log('🔔 Loading premium notifications...');
            const container = document.getElementById('notificationList');
            if (!container) return;

            try {
                const notifications = await DashboardAPI.loadNotifications();

                // update notification badges
                const badgeElems = [];
                ['notificationCount', 'notificationCountBottom'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) badgeElems.push(el);
                });

                const unreadCount = notifications.filter(n => !n.is_read).length;
                badgeElems.forEach(badge => {
                    badge.textContent = unreadCount;
                    badge.style.display = unreadCount > 0 ? 'flex' : 'none';
                });

                if (notifications.length === 0) {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 60px 40px; color: #94a3b8;">
                            <div style="width: 80px; height: 80px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                                <i class="fas fa-bell-slash" style="font-size: 32px; color: #cbd5e1;"></i>
                            </div>
                            <h3 style="color: #1e293b; margin-bottom: 8px; font-weight: 700;">No notifications yet</h3>
                            <p style="font-size: 14px;">You're all caught up!</p>
                        </div>
                    `;
                    return;
                }

                container.innerHTML = notifications.map(n => {
                    let icon = 'fa-bell';
                    if (n.type === 'spark') icon = 'fa-fire';
                    else if (n.type === 'follow') icon = 'fa-user-plus';
                    else if (n.type === 'comment') icon = 'fa-comment';
                    else if (n.type === 'share') icon = 'fa-share';

                    return `
                        <div class="notification-item ${n.is_read ? '' : 'unread'}" 
                             onclick="window.handleNotificationClick('${n.notification_id || n.id}', '${n.action_url || ''}')">
                            <div class="notification-icon-wrapper">
                                <i class="fas ${icon}"></i>
                            </div>
                            <div class="notification-content">
                                <div class="notification-message">
                                    <strong>${n.actor_name || 'Someone'}</strong> ${n.content || 'performed an action'}
                                </div>
                                <div class="notification-time">${DashboardAPI.formatTimestamp(n.created_at)}</div>
                            </div>
                            ${!n.is_read ? '<div class="unread-dot-premium"></div>' : ''}
                        </div>
                    `;
                }).join('');

            } catch (err) {
                console.error('Failed to load notifications:', err);
            }
        };

        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            if (item.querySelector('.fa-bell')) {
                item.onclick = (e) => {
                    loadNotifications();
                    // open whichever UI is appropriate for this page
                    if (typeof showNotificationsModal === 'function') showNotificationsModal();
                    if (typeof toggleNotifications === 'function') toggleNotifications();
                };
            }
        });

        // ============ SCRIPT.JS COMPATIBILITY MAPPERS ============
        window.loadMarketplaceContent = (cat) => window.loadMarketplace(cat);
        window.loadLostFoundContent = (type) => window.loadLostFoundItems(type);
        window.loadSkillMarketContent = (type) => window.loadSkillOffers(type);

        window.loadLostFoundItems = async function (type) {
            const container = document.getElementById('lostFoundContent') || document.getElementById('lostFoundGrid');
            if (!container) return;

            try {
                container.innerHTML = '<div style="text-align:center; padding:40px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
                const campus = localStorage.getItem('sparkleUserCampus') || 'all';
                const items = await DashboardAPI.loadLostFoundItems(type || 'all', campus);

                container.innerHTML = '';
                if (items.length === 0) {
                    container.innerHTML = '<div style="text-align:center; padding:40px; color:#999;">No items found.</div>';
                    return;
                }

                items.forEach(item => {
                    const el = document.createElement('div');
                    el.className = 'market-card';
                    el.style = 'background: white; border-radius: 10px; margin-bottom: 15px; border: 1px solid var(--border); overflow: hidden;';
                    el.innerHTML = `
                        <div style="padding:15px; border-left: 5px solid ${item.type === 'lost' ? '#ff4757' : '#2ed573'};">
                            <div style="font-weight:bold; font-size:16px; color: #333;">${item.item_name || item.title}</div>
                            <div style="font-size:12px; color:#666; margin:5px 0;">
                                <i class="fas fa-map-marker-alt"></i> ${item.location} • ${item.date_lost || item.date_found || 'Recently'}
                            </div>
                            <div style="margin:10px 0; color: #555;">${item.description}</div>
                            <button class="btn btn-sm ${item.type === 'lost' ? 'btn-danger' : 'btn-success'}" 
                                    style="background: ${item.type === 'lost' ? '#ff4757' : '#2ed573'}; color: white; border:none; border-radius: 4px; padding: 5px 10px;"
                                    onclick="contactSeller('${item.user_id}', '${item.contact_name || 'User'}')">
                                ${item.type === 'lost' ? 'I Found This' : 'Claim This'}
                            </button>
                        </div>
                    `;
                    container.appendChild(el);
                });
            } catch (e) {
                console.error('Failed to load lost & found', e);
                container.innerHTML = '<div style="text-align:center; color:red;">Failed to load items.</div>';
                showNotification('Failed to load lost & found items', 'error');
            }
        };

        window.loadSkillOffers = async function (type) {
            const container = document.getElementById('skillMarketContent');
            if (!container) return;

            try {
                container.innerHTML = '<div style="text-align:center; padding:40px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
                const campus = localStorage.getItem('sparkleUserCampus') || 'all';
                const skills = await DashboardAPI.loadSkillOffers(type || 'all', campus);

                container.innerHTML = '';
                if (skills.length === 0) {
                    container.innerHTML = '<div style="text-align:center; padding:40px; color:#999;">No skill offers found.</div>';
                    return;
                }

                skills.forEach(skill => {
                    const el = document.createElement('div');
                    el.className = 'group-card';
                    el.style = 'background: white; border-radius: 12px; margin-bottom: 15px; border: 1px solid var(--border); overflow: hidden;';
                    el.innerHTML = `
                        <div style="padding: 15px; display:flex; align-items:center; gap:15px;">
                            <div style="width:40px; height:40px; background:#e1b12c; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; flex-shrink: 0;">
                                <i class="fas fa-lightbulb"></i>
                            </div>
                            <div style="flex:1;">
                                <div style="font-weight:bold; color: #333;">${skill.title}</div>
                                <div style="font-size:12px; color:#666;">${skill.user_name || 'Student'} • ${skill.category || 'General'}</div>
                                <div style="font-size:13px; color: #555; margin-top:5px;">${skill.description}</div>
                            </div>
                            <button class="btn btn-primary btn-sm" onclick="startChatWithUser('${skill.user_id}')">Request</button>
                        </div>
                    `;
                    container.appendChild(el);
                });
            } catch (e) {
                console.error('Failed to load skills', e);
                container.innerHTML = '<div style="text-align:center; color:red;">Failed to load skills.</div>';
                showNotification('Failed to load skill offers', 'error');
            }
        };

        window.showGroupManagement = () => {
            if (typeof showModal === 'function') showModal('groupManagement');
            window.loadGroups();
        };

        window.showGroupFeed = () => {
            if (typeof showModal === 'function') showModal('groupFeed');
            window.loadGroupFeed();
        };

        window.loadGroupManagement = () => window.loadGroups();

        window.loadGroupFeed = () => {
            const container = document.getElementById('groupFeedContent') || document.getElementById('activePolls');
            if (container) {
                container.innerHTML = '<p style="text-align:center; padding:20px; color: #666;">Loading group feed...</p>';
                DashboardAPI.loadFeed().then(posts => {
                    container.innerHTML = '';
                    const feedNodes = posts.map(post => window.createPostElement(post));
                    feedNodes.forEach(node => container.appendChild(node));
                }).catch(e => {
                    container.innerHTML = '<p style="text-align:center; color:red;">Failed to load group feed.</p>';
                    showNotification('Failed to load group feed', 'error');
                });
            }
        };

        window.showMarketplace = (category) => {
            if (typeof showModal === 'function') showModal('marketplace');
            window.loadMarketplace(category);
        };

        window.showLostFound = (type) => {
            if (typeof showModal === 'function') showModal('lostFound');
            window.loadLostFoundItems(type);
        };

        // ============ CORE LOADING FUNCTIONS ============
        window.loadAfterglowStories = async function (options = {}) {
            const isSilent = options.silent || false;
            const container = document.getElementById('afterglowStories');
            if (!container) return;

            try {
                if (!isSilent) {
                    console.log('📖 Loading stories from API...');
                }
                let groups = await DashboardAPI.loadStories();
                // server now returns groups with a `stories` array; if old flat list detected, group client-side
                if (groups && groups.length && !groups[0].stories) {
                    const map = {};
                    groups.forEach(s => {
                        if (!map[s.user_id]) {
                            map[s.user_id] = {
                                user_id: s.user_id,
                                username: s.username,
                                user_name: s.user_name,
                                avatar_url: s.avatar_url,
                                campus: s.campus,
                                stories: []
                            };
                        }
                        map[s.user_id].stories.push(s);
                    });
                    groups = Object.values(map);
                }

                const fragment = document.createDocumentFragment();

                // Always add the Create Story card first
                const currentUserData = window.currentUserData || { avatar: '' };
                const createCard = document.createElement('div');
                createCard.className = 'story-create-card';
                createCard.onclick = () => window.showCreateOptions();
                createCard.innerHTML = `
                    <div class="story-create-content">
                        <div class="story-create-top">
                            <img src="${currentUserData.avatar || '/uploads/avatars/default.png'}"
                                 style="width: 50px; height: 50px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                        </div>
                        <div class="story-plus-btn">
                            <i class="fas fa-plus"></i>
                        </div>
                        <div class="story-create-bottom">
                            Post Glow
                        </div>
                    </div>
                `;
                fragment.appendChild(createCard);

                if (!groups || groups.length === 0) {
                    // Only show hint if the container is currently empty of stories
                    if (!container.querySelector('.story-view-card')) {
                        const hint = document.createElement('div');
                        hint.style.cssText = 'display: flex; align-items: center; padding: 0 10px;';
                        hint.innerHTML = `
                            <div class="vanish-timer" style="background: transparent; padding: 0; color: #94a3b8; font-size: 13px;">
                                No active glows yet. <span onclick="window.showCreateOptions()" style="color: var(--accent); cursor: pointer; font-weight: 700; margin-left: 5px;">Spark One!</span>
                            </div>
                        `;
                        fragment.appendChild(hint);
                    } else {
                        // Already have stories (from EJS), and fetch returned nothing? 
                        // Likely a transient error or just no NEW stories. Keep what we have.
                        return;
                    }
                } else {
                    groups.forEach((group) => {
                        const storyEl = document.createElement('div');
                        storyEl.className = 'story-view-card';
                        storyEl.dataset.userId = group.user_id;
                        storyEl.dataset.secondsLeft = group.stories[0]?.secondsLeft || 0;

                        storyEl.innerHTML = `
                            <div class="story-media-container" style="position:relative; width:100%; height:100%;">
                                <img src="${group.stories[0]?.media_url || group.avatar_url || '/uploads/avatars/default.png'}" 
                                     class="story-media-bg"
                                     onerror="this.src='/uploads/avatars/default.png'"
                                     style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; filter:brightness(0.85);">
                                
                                <div class="story-overlay-gradient" style="position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 40%);"></div>
                                
                                ${group.stories.length > 1 ? `<div class="story-multi-badge" style="position:absolute; top:10px; right:10px; background:rgba(255,255,255,0.2); backdrop-filter:blur(4px); color:white; padding:2px 6px; border-radius:8px; font-size:10px; font-weight:800; border:1px solid rgba(255,255,255,0.3); z-index:3;">${group.stories.length}</div>` : ''}

                                <div class="story-avatar-badge" style="position:absolute; top:10px; left:10px; width:34px; height:34px; border-radius:50%; border:2px solid var(--accent); padding:2px; background:white; z-index:3; box-shadow:0 4px 8px rgba(0,0,0,0.2);">
                                    <img src="${group.avatar_url || '/uploads/avatars/default.png'}"
                                         style="width:100%; height:100%; border-radius:50%; object-fit:cover;"
                                         onerror="this.src='/uploads/avatars/default.png'">
                                </div>

                                <div class="story-username-label" style="position:absolute; bottom:12px; left:10px; right:10px; color:white; font-size:11px; font-weight:700; text-shadow:0 1px 3px rgba(0,0,0,0.6); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; z-index:3;">
                                    ${group.username || 'Sparkler'}
                                </div>
                            </div>
                        `;

                        storyEl.addEventListener('click', () => {
                            window.activeStories = group.stories;
                            window.currentStoryIndex = 0;
                            showAfterglowViewer(window.activeStories[0]);
                        });
                        fragment.appendChild(storyEl);
                    });
                }

                container.innerHTML = '';
                container.appendChild(fragment);

            } catch (error) {
                console.error('❌ Failed to load stories:', error);
                if (!isSilent) {
                    showNotification('Failed to load stories', 'error');
                }
            }
        };

        // ============ AFTERGLOW STORY VIEWER ============
        window.showAfterglowViewer = function (story) {
            console.log('📖 Opening story viewer for:', story);

            // If we have multiple stories in activeStories, use that
            const stories = window.activeStories || [story];
            const startIndex = window.currentStoryIndex || 0;

            const modal = document.createElement('div');
            modal.className = 'afterglow-viewer-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.95);
                z-index: 100000;
                display: flex;
                align-items: center;
                justify-content: center;
            `;

            let currentIndex = startIndex;
            let progressInterval;
            let timeLeft = 5; // seconds per story

            function renderStory(index) {
                const currentStory = stories[index];
                if (!currentStory) return;

                const isVideo = currentStory.media_url?.match(/\.(mp4|webm|mov)$/i) ||
                    currentStory.media?.match(/\.(mp4|webm|mov)$/i) ||
                    currentStory.type === 'video';

                const mediaUrl = currentStory.media_url || currentStory.media || '';
                const username = currentStory.username || currentStory.user_name || 'Sparkler';
                const avatar = currentStory.avatar_url || currentStory.avatar || '/uploads/avatars/default.png';
                const caption = currentStory.caption || '';
                const timestamp = currentStory.created_at ? new Date(currentStory.created_at).toLocaleTimeString() : 'Just now';

                modal.innerHTML = `
                    <div style="width: 100%; max-width: 400px; height: 100%; max-height: 700px; position: relative; background: #000; border-radius: 20px; overflow: hidden;">
                        <!-- Progress bars -->
                        <div style="position: absolute; top: 10px; left: 10px; right: 10px; display: flex; gap: 5px; z-index: 10;">
                            ${stories.map((_, i) => `
                                <div style="flex: 1; height: 3px; background: rgba(255,255,255,0.3); border-radius: 3px; overflow: hidden;">
                                    <div class="progress-bar-${i}" style="width: ${i < index ? '100%' : i === index ? '0%' : '0%'}; height: 100%; background: white; transition: width 5s linear;"></div>
                                </div>
                            `).join('')}
                        </div>

                        <!-- Close button -->
                        <button class="close-story" style="position: absolute; top: 20px; right: 20px; background: rgba(0,0,0,0.5); color: white; border: none; width: 40px; height: 40px; border-radius: 50%; font-size: 24px; cursor: pointer; z-index: 20; display: flex; align-items: center; justify-content: center;">&times;</button>

                        <!-- Media -->
                        ${isVideo ? `
                            <video id="storyVideo" src="${mediaUrl}" 
                                   style="width: 100%; height: 100%; object-fit: contain;" 
                                   autoplay playsinline
                                   onerror="this.style.display='none'; this.parentElement.innerHTML += '<div style=\'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#999;\'><i class=\'fas fa-video-slash\' style=\'font-size:40px;margin-bottom:10px;\'></i><span>Video Unavailable</span></div>'"></video>
                        ` : `
                            <img src="${mediaUrl}" 
                                 style="width: 100%; height: 100%; object-fit: contain;" 
                                 onerror="this.src='/uploads/avatars/default.png'; this.style.filter='blur(10px) brightness(0.5)';">
                        `}

                        <!-- User info overlay -->
                        <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 60px 20px 30px; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                                <img src="${avatar}" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid white; object-fit: cover;">
                                <div>
                                    <div style="color: white; font-weight: 600;">${username}</div>
                                    <div style="color: rgba(255,255,255,0.7); font-size: 11px;">${timestamp}</div>
                                </div>
                            </div>
                            ${caption ? `<div style="color: white; font-size: 14px; line-height: 1.4;">${caption}</div>` : ''}
                        </div>

                        <!-- Navigation areas (left/right click) -->
                        <div style="position: absolute; top: 0; bottom: 0; left: 0; width: 30%; cursor: pointer; z-index: 15;" class="prev-story"></div>
                        <div style="position: absolute; top: 0; bottom: 0; right: 0; width: 30%; cursor: pointer; z-index: 15;" class="next-story"></div>
                    </div>
                `;

                // Start progress animation for current story
                if (index < stories.length) {
                    const progressBar = modal.querySelector(`.progress-bar-${index}`);
                    if (progressBar) {
                        // Force reflow
                        progressBar.style.transition = 'none';
                        progressBar.style.width = '0%';
                        setTimeout(() => {
                            progressBar.style.transition = 'width 5s linear';
                            progressBar.style.width = '100%';
                        }, 50);
                    }
                }

                // Handle video playback
                if (isVideo) {
                    const video = modal.querySelector('#storyVideo');
                    if (video) {
                        video.onloadedmetadata = () => {
                            timeLeft = video.duration;
                        };
                        video.onended = () => goToNext();
                    }
                } else {
                    // Auto advance for images
                    clearInterval(progressInterval);
                    progressInterval = setInterval(() => {
                        goToNext();
                    }, 5000);
                }
            }

            function goToNext() {
                if (currentIndex < stories.length - 1) {
                    currentIndex++;
                    renderStory(currentIndex);
                } else {
                    closeViewer();
                }
            }

            function goToPrev() {
                if (currentIndex > 0) {
                    currentIndex--;
                    renderStory(currentIndex);
                } else {
                    closeViewer();
                }
            }

            function closeViewer() {
                clearInterval(progressInterval);
                modal.classList.add('fade-out');
                setTimeout(() => {
                    if (modal.parentNode) modal.remove();
                }, 300);
            }

            // Render first story
            renderStory(currentIndex);

            // Add event listeners after render
            setTimeout(() => {
                const closeBtn = modal.querySelector('.close-story');
                const prevArea = modal.querySelector('.prev-story');
                const nextArea = modal.querySelector('.next-story');

                closeBtn?.addEventListener('click', closeViewer);
                prevArea?.addEventListener('click', goToPrev);
                nextArea?.addEventListener('click', goToNext);

                // Keyboard navigation
                const keyHandler = (e) => {
                    if (e.key === 'ArrowLeft') {
                        goToPrev();
                    } else if (e.key === 'ArrowRight') {
                        goToNext();
                    } else if (e.key === 'Escape') {
                        closeViewer();
                    }
                };
                document.addEventListener('keydown', keyHandler);

                // Clean up keyboard listener when modal closes
                modal.cleanup = () => {
                    document.removeEventListener('keydown', keyHandler);
                    clearInterval(progressInterval);
                };
            }, 100);

            document.body.appendChild(modal);

            // Add animation styles
            const style = document.createElement('style');
            style.textContent = `
                .afterglow-viewer-modal {
                    animation: fadeIn 0.3s ease;
                }
                .afterglow-viewer-modal.fade-out {
                    animation: fadeOut 0.3s ease forwards;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                .close-story:hover {
                    background: rgba(255,255,255,0.2) !important;
                }
                .prev-story:hover, .next-story:hover {
                    background: rgba(255,255,255,0.05);
                }
            `;
            document.head.appendChild(style);
        };

        window.afterglowTimerInterval = setInterval(() => {
            const container = document.getElementById('afterglowStories');
            if (!container) return;
            const items = container.querySelectorAll('.story-view-card');
            items.forEach(item => {
                let seconds = parseInt(item.dataset.secondsLeft);
                if (!isNaN(seconds) && seconds > 0) {
                    seconds -= 60;
                    item.dataset.secondsLeft = seconds;
                    const timeEl = item.querySelector('.story-time');
                    if (timeEl) {
                        const h = Math.floor(seconds / 3600);
                        const m = Math.floor((seconds % 3600) / 60);
                        if (h > 0) timeEl.textContent = `${h}h ${m}m`;
                        else timeEl.textContent = `${m}m`;
                    }

                    const ring = item.querySelector('.story-avatar-ring');
                    if (ring) ring.style.opacity = Math.max(0.1, seconds / 7200);
                } else {
                    item.remove();
                }
            });
        }, 60000);

        window.viewAfterglow = function (story) {
            if (typeof showAfterglowViewer === 'function') {
                if (typeof DashboardAPI !== 'undefined') {
                    DashboardAPI.loadStories().then(stories => {
                        window.activeStories = stories || [];
                        const index = stories.findIndex(s => (s.story_id || s.id) === (story.story_id || story.id));
                        window.currentStoryIndex = index !== -1 ? index : 0;
                        showAfterglowViewer(story);
                    }).catch(err => {
                        console.error("Failed to load stories for viewer:", err);
                        showAfterglowViewer(story);
                    });
                } else {
                    showAfterglowViewer(story);
                }
            } else {
                console.warn("showAfterglowViewer not found in script.js");
                showNotification('Story viewer not available', 'warning');
            }
        };

        window.loadGroups = async function () {
            const containers = [
                document.getElementById('groupsContainer'),
                document.getElementById('groupManagementContent')
            ].filter(el => el !== null);

            if (containers.length === 0) return;

            try {
                containers.forEach(c => c.innerHTML = '<div style="text-align:center; padding:40px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>');
                const userCampus = localStorage.getItem('sparkleUserCampus') || JSON.parse(localStorage.getItem('sparkleUser') || '{}').campus;
                const groups = await DashboardAPI.loadGroups(userCampus);

                const html = groups.length === 0 ?
                    '<div style="text-align:center; padding:40px; color:#999;">No groups found.</div>' :
                    groups.map(group => `
                    <div class="group-card" style="background: white; border-radius: 12px; margin-bottom: 20px; border: 1px solid var(--border); overflow: hidden;">
                        <div style="padding: 15px;">
                            <div style="display: flex; align-items: center; margin-bottom: 12px;">
                                <div style="width: 45px; height: 45px; border-radius: 10px; background: var(--primary); display: flex; align-items: center; justify-content: center; color: white; overflow: hidden;">
                                    ${group.icon_url ?
                            `<img src="${group.icon_url}" style="width: 100%; height: 100%; object-fit: cover;">` :
                            `<i class="${group.icon || 'fas fa-users'}"></i>`
                        }
                                </div>
                                <div style="flex: 1; margin-left:12px;">
                                    <div style="font-weight: 600; color: #333;">${group.name}</div>
                                    <div style="font-size: 12px; color: #666;">${group.members} members • ${group.campus}</div>
                                </div>
                                <button class="btn btn-primary btn-sm" onclick="DashboardAPI.joinGroup('${group.id}').then(() => window.loadGroups())">
                                    ${group.isJoined ? 'Joined' : 'Join'}
                                </button>
                            </div>
                            <div style="font-size: 13px; color: #555;">${group.description}</div>
                        </div>
                    </div>
                    `).join('');

                containers.forEach(c => c.innerHTML = html);
            } catch (error) {
                console.error('Failed to load groups:', error);
                containers.forEach(c => c.innerHTML = '<div style="color:red; text-align:center; padding:20px;">Failed to load groups</div>');
                showNotification('Failed to load groups', 'error');
            }
        };

        window.showComments = async function (postId) {
            try {
                const comments = await DashboardAPI.loadComments(postId);
                const modal = document.createElement('div');
                modal.className = 'modal';
                modal.style.display = 'flex';
                modal.innerHTML = `
                    <div class="modal-content" style="max-width: 500px; max-height: 80vh;">
                        <div class="modal-header">
                            <div class="modal-title" style="color: #333;">Comments (${comments.length})</div>
                            <button class="close-modal">&times;</button>
                        </div>
                        <div class="modal-body" style="overflow-y: auto;">
                            <div id="commentsList">
                                ${comments.map(c => `
                                    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                                        <img src="${c.avatar}" style="width: 32px; height: 32px; border-radius: 50%;">
                                        <div>
                                            <div style="font-weight: 700; font-size: 13px; color: #1e293b;">@${c.username}</div>
                                            <div style="font-size: 14px; color: #334155; line-height: 1.4;">${c.content}</div>
                                            <div style="font-size: 11px; color: #999;">${c.timestamp}</div>
                                        </div>
                                    </div>
                                `).join('')}
                                ${comments.length === 0 ? '<p style="text-align:center; color:#999;">No comments yet.</p>' : ''}
                            </div>
                        </div>
                        <div class="modal-footer" style="padding:15px; border-top:1px solid #eee; display:flex; gap:10px;">
                            <input type="text" id="newCommentInput" class="form-control" placeholder="Write a comment..." style="flex:1; color: #333;">
                            <button class="btn btn-primary" onclick="window.submitComment('${postId}')">Post</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
                modal.querySelector('.close-modal').onclick = () => modal.remove();
            } catch (err) {
                console.error(err);
                showNotification('Failed to load comments', 'error');
            }
        };

        window.submitComment = async (postId) => {
            const input = document.getElementById('newCommentInput');
            if (!input || !input.value.trim()) {
                showNotification('Please enter a comment', 'warning');
                return;
            }

            try {
                await DashboardAPI.postComment(postId, input.value.trim());
                showNotification('Comment posted!', 'success');
                document.querySelector('.modal').remove();
                if (window.loadFeedPosts) window.loadFeedPosts();
            } catch (err) {
                console.error(err);
                showNotification('Failed to post comment', 'error');
            }
        };

        window.contactSeller = function (sellerId, sellerName) {
            const item = document.querySelector(`.market-card button[onclick*="contactSeller('${sellerId}')"]`)?.closest('.market-card');
            const sellerAvatar = item?.querySelector('img[src*="placeholder.com"]') ? '/uploads/avatars/default.png' : item?.querySelector('img')?.src || '/uploads/avatars/default.png';
            startChat({ id: sellerId, name: sellerName, avatar: sellerAvatar });
        };

        const marketCategories = document.getElementById('marketCategories');
        if (marketCategories) {
            marketCategories.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (btn) {
                    marketCategories.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    loadMarketplace(btn.dataset.category);
                }
            });
        }

        // ============ HELPER FUNCTIONS ============
        window.joinGroupFromAPI = async function (groupId) {
            try {
                await DashboardAPI.joinGroup(groupId);
                showNotification('Joined group successfully!', 'success');
                loadGroups();
            } catch (error) {
                showNotification('Failed to join group', 'error');
            }
        };

        window.followUserFromAPI = async function (userId) {
            try {
                await DashboardAPI.followUser(userId);
                showNotification('Following user!', 'success');
                loadConnectUsers();
            } catch (error) {
                showNotification('Failed to follow user', 'error');
            }
        };

        window.sparkPostFromAPI = async function (postId) {
            try {
                await DashboardAPI.sparkPost(postId);
                loadFeedPosts();
                showNotification('Post sparked!', 'success');
            } catch (error) {
                console.error('Failed to spark post:', error);
                showNotification('Failed to spark post', 'error');
            }
        };

        // ============ AUTO-LOAD DATA ON PAGE LOAD ============
        window.addEventListener('load', () => {
            console.log('📱 Dashboard loaded - Auto-loading Feed and Stories...');

            setTimeout(() => {
                if (typeof window.loadFeedPosts === 'function') {
                    const feedContainer = document.getElementById('feed');
                    if (feedContainer) {
                        console.log('📱 Auto-loading Feed posts...');
                        window.loadFeedPosts();
                    }
                }

                if (typeof window.loadAfterglowStories === 'function') {
                    const storiesContainer = document.getElementById('afterglowStories');
                    if (storiesContainer) {
                        console.log('📱 Auto-loading Stories...');
                        window.loadAfterglowStories();
                    }
                }

                if (typeof window.loadMoments === 'function') {
                    const momentsContainer = document.getElementById('momentsList') || document.getElementById('momentsGrid');
                    if (momentsContainer) {
                        console.log('📱 Auto-loading Moments...');
                        window.loadMoments();
                    }
                }
            }, 500);
        });

        // ============ GROUP CREATION MODAL ============
        window.createGroup = function () {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <div class="modal-title" style="color: #333;">Create a New Group</div>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label" style="color: #333;">Group Name</label>
                            <input type="text" id="newGroupName" class="form-control" placeholder="e.g. Computer Science Study Group">
                        </div>
                        <div class="form-group">
                            <label class="form-label" style="color: #333;">Description</label>
                            <textarea id="newGroupDesc" class="form-control" rows="3" placeholder="What is this group about?"></textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label" style="color: #333;">Category</label>
                            <select id="newGroupCategory" class="form-control">
                                <option value="study">Study</option>
                                <option value="social">Social</option>
                                <option value="sports">Sports</option>
                                <option value="hobby">Hobby</option>
                            </select>
                        </div>
                        <button class="btn btn-primary btn-block" id="confirmCreateGroupBtn">
                            <i class="fas fa-plus"></i> Create Group
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            modal.querySelector('.close-modal').onclick = () => document.body.removeChild(modal);
            modal.addEventListener('click', (e) => { if (e.target === modal) document.body.removeChild(modal); });

            modal.querySelector('#confirmCreateGroupBtn').onclick = async () => {
                const name = document.getElementById('newGroupName').value.trim();
                const description = document.getElementById('newGroupDesc').value.trim();
                const category = document.getElementById('newGroupCategory').value;

                if (!name) {
                    showNotification('Please enter a group name', 'warning');
                    return;
                }

                try {
                    showNotification('Creating group...', 'info');
                    await DashboardAPI.createGroup({ name, description, category });
                    showNotification('Group created successfully!', 'success');
                    document.body.removeChild(modal);
                    if (window.loadGroups) loadGroups();
                } catch (err) {
                    showNotification('Failed to create group', 'error');
                }
            };
        };

        const createGroupBtn = document.getElementById('createGroupBtn');
        if (createGroupBtn) {
            createGroupBtn.onclick = () => window.createGroup();
        }

        // ============ OVERRIDE AFTERGLOW UPLOAD ============
        window.uploadAfterglowMedia = async function () {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*,video/*';
            input.style.display = 'none';

            // Clean up after the user picks a file or cancels
            let cleaned = false;
            const cleanup = () => {
                if (!cleaned && input.parentNode) {
                    cleaned = true;
                    input.parentNode.removeChild(input);
                }
            };

            input.addEventListener('change', async function (e) {
                const file = e.target.files[0];
                cleanup();
                if (!file) return;

                showNotification('Uploading story...', 'info');

                try {
                    console.log('📡 dynamicPatch: Creating story with direct file...', file.name);

                    await DashboardAPI.createStory({
                        media: file,
                        caption: ''
                    });

                    showNotification('Story shared!', 'success');
                    if (window.loadAfterglowStories) window.loadAfterglowStories();
                    else if (typeof loadAfterglowStories === 'function') loadAfterglowStories();

                } catch (error) {
                    console.error('❌ Story creation failed:', error);
                    showNotification(error.message || 'Failed to share story', 'error');
                }
            });

            // Detect cancel: window refocuses after file picker closes without selection
            window.addEventListener('focus', function onFocus() {
                setTimeout(() => {
                    cleanup();
                    window.removeEventListener('focus', onFocus);
                }, 500);
            }, { once: true });

            document.body.appendChild(input);
            input.click();
        };

        // ============ CREATE LISTING ============
        window.createListing = async function () {
            const title = prompt("Enter item title:");
            if (!title) return;
            const price = prompt("Enter price:");
            const category = prompt("Enter category (Books, Electronics, Furniture, Fashion, Other):");

            try {
                await DashboardAPI.createListing({
                    title,
                    price: parseFloat(price),
                    category,
                    description: `Student selling ${title}`,
                    campus: currentCampus
                });
                showNotification('Listing created!', 'success');
                if (window.loadMarketplace) await loadMarketplace();
            } catch (error) {
                showNotification('Failed to create listing', 'error');
            }
        };

        const createListingBtn = document.getElementById('createListingBtn');
        if (createListingBtn) {
            createListingBtn.addEventListener('click', createListing);
        }

        // ============ POST CREATION & MEDIA UPLOAD ============
        const oldSubmitBtn = document.getElementById('submitPostBtn');
        const oldMediaInput = document.getElementById('mediaUpload');

        if (oldSubmitBtn) {
            const newSubmitBtn = oldSubmitBtn.cloneNode(true);
            oldSubmitBtn.parentNode.replaceChild(newSubmitBtn, oldSubmitBtn);
        }

        if (oldMediaInput) {
            const newMediaInput = oldMediaInput.cloneNode(true);
            oldMediaInput.parentNode.replaceChild(newMediaInput, oldMediaInput);
        }

        const mediaUploadArea = document.getElementById('mediaUploadArea');
        const mediaUploadInput = document.getElementById('mediaUpload');
        const mediaPreview = document.getElementById('mediaPreview');
        const submitPostBtn = document.getElementById('submitPostBtn');
        const postCaption = document.getElementById('postCaption');
        const postTags = document.getElementById('postTags');

        if (mediaUploadArea && mediaUploadInput) {
            mediaUploadArea.onclick = null;
            mediaUploadArea.addEventListener('click', () => mediaUploadInput.click());

            mediaUploadInput.addEventListener('change', function (e) {
                const files = e.target.files;
                if (files && files.length > 0) {
                    mediaPreview.innerHTML = '';
                    mediaPreview.style.display = 'grid';
                    mediaPreview.style.gridTemplateColumns = 'repeat(auto-fill, minmax(100px, 1fr))';
                    mediaPreview.style.gap = '10px';
                    mediaPreview.style.marginTop = '15px';

                    Array.from(files).forEach((file, index) => {
                        const isVideo = file.type.startsWith('video');
                        const url = URL.createObjectURL(file);

                        const item = document.createElement('div');
                        item.style.position = 'relative';
                        item.innerHTML = `
                            ${isVideo ?
                                `<video src="${url}" style="width: 100%; height: 100px; border-radius: 10px; object-fit: cover;"></video>` :
                                `<img src="${url}" style="width: 100%; height: 100px; border-radius: 10px; object-fit: cover;">`
                            }
                            <div class="remove-media" data-index="${index}" style="position: absolute; top: -5px; right: -5px; background: #ff4757; color: white; border: none; width: 20px; height: 20px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">&times;</div>
                        `;
                        mediaPreview.appendChild(item);
                    });

                    mediaPreview.querySelectorAll('.remove-media').forEach(btn => {
                        btn.onclick = (e) => {
                            e.stopPropagation();
                            // In a real app we'd filter the FileList, but for now we'll just clear or hide
                            // This is a bit simplified for the patch
                            showNotification('Removing items currently clears all in this demo patch', 'info');
                            mediaUploadInput.value = '';
                            mediaPreview.innerHTML = '';
                        };
                    });
                }
            });
        }

        if (submitPostBtn) {
            document.querySelectorAll('.type-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    document.querySelectorAll('.type-chip').forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');
                });
            });

            submitPostBtn.addEventListener('click', async () => {
                const caption = postCaption.value.trim();
                const tagsRaw = postTags.value.trim();
                const file = mediaUploadInput.files[0];
                const postType = document.querySelector('.type-chip.active')?.dataset.postType || 'public';

                if (!caption && !file) {
                    showNotification('Please add a caption or media', 'warning');
                    return;
                }

                submitPostBtn.disabled = true;
                submitPostBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';

                try {
                    const tags = tagsRaw ? tagsRaw.split(' ').map(t => t.replace('#', '')) : [];
                    const location = document.getElementById('postLocation')?.value.trim();

                    await DashboardAPI.createPost({
                        caption,
                        mediaFiles: Array.from(mediaUploadInput.files || []),
                        tags: JSON.stringify(tags),
                        isAnonymous: postType === 'anonymous',
                        postType: postType,
                        location: location
                    });

                    showNotification('Post shared successfully!', 'success');
                    postCaption.value = '';
                    postTags.value = '';
                    mediaUploadInput.value = '';
                    mediaPreview.innerHTML = '';
                    if (typeof hideModal === 'function') hideModal('create');
                    if (window.loadFeedPosts) loadFeedPosts();
                } catch (error) {
                    console.error('Post creation failed:', error);
                    showNotification('Failed to share post', 'error');
                } finally {
                    submitPostBtn.disabled = false;
                    submitPostBtn.innerHTML = '<span>Spark It!</span> <i class="fas fa-bolt"></i>';
                }
            });
        }

        // ============ MOMENT CREATION ============
        const momentUploadArea = document.getElementById('momentUploadArea');
        const momentVideoUpload = document.getElementById('momentVideoUpload');
        const momentPreview = document.getElementById('momentPreview');
        const submitMomentBtn = document.getElementById('submitMomentBtn');
        const momentCaption = document.getElementById('momentCaption');

        if (momentUploadArea && momentVideoUpload) {
            momentUploadArea.onclick = null;
            momentUploadArea.addEventListener('click', () => momentVideoUpload.click());

            momentVideoUpload.addEventListener('change', function (e) {
                const file = e.target.files[0];
                if (file) {
                    momentPreview.innerHTML = `
                        <div style="position: relative; display: inline-block; width: 100%;">
                            <video src="${URL.createObjectURL(file)}" style="max-width: 100%; border-radius: 12px; margin-top: 10px;" controls></video>
                            <button id="removeMomentVideoBtn" style="position: absolute; top: 0; right: 0; background: #ff4757; color: white; border: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; z-index: 10;">&times;</button>
                        </div>
                    `;
                    document.getElementById('removeMomentVideoBtn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        momentVideoUpload.value = '';
                        momentPreview.innerHTML = '';
                    });
                }
            });
        }

        if (submitMomentBtn) {
            const newSubmitMomentBtn = submitMomentBtn.cloneNode(true);
            submitMomentBtn.parentNode.replaceChild(newSubmitMomentBtn, submitMomentBtn);

            newSubmitMomentBtn.addEventListener('click', async () => {
                const caption = momentCaption.value.trim();
                const file = momentVideoUpload.files[0];

                if (!file) {
                    showNotification('Please select a video for your moment', 'warning');
                    return;
                }

                newSubmitMomentBtn.disabled = true;
                newSubmitMomentBtn.innerHTML = '<span>Sharing...</span> <i class="fas fa-spinner fa-spin"></i>';

                try {
                    await DashboardAPI.createMoment({
                        caption,
                        media: file
                    });

                    showNotification('Moment shared successfully!', 'success');
                    momentCaption.value = '';
                    momentVideoUpload.value = '';
                    momentPreview.innerHTML = '';
                    if (typeof hideModal === 'function') hideModal('moment');
                    if (window.location.pathname.includes('/moments')) {
                        location.reload();
                    }
                } catch (error) {
                    console.error('Moment creation failed:', error);
                    showNotification('Failed to share moment', 'error');
                } finally {
                    newSubmitMomentBtn.disabled = false;
                    newSubmitMomentBtn.innerHTML = '<span>Share Moment!</span> <i class="fas fa-play"></i>';
                }
            });
        }

        // ============ AFTERGLOW (STORY) CREATION ============
        const afterglowUploadArea = document.getElementById('afterglowUploadArea');
        const afterglowMediaUpload = document.getElementById('afterglowMediaUpload');
        const afterglowPreview = document.getElementById('afterglowPreview');
        const submitAfterglowBtn = document.getElementById('submitAfterglowBtn');
        const afterglowCaption = document.getElementById('afterglowCaption');

        if (afterglowUploadArea && afterglowMediaUpload) {
            afterglowUploadArea.onclick = null;
            afterglowUploadArea.addEventListener('click', () => afterglowMediaUpload.click());

            afterglowMediaUpload.addEventListener('change', function (e) {
                const file = e.target.files[0];
                if (file) {
                    const isVideo = file.type.startsWith('video');
                    afterglowPreview.innerHTML = `
                        <div style="position: relative; display: inline-block; width: 100%;">
                            ${isVideo ?
                            `<video src="${URL.createObjectURL(file)}" style="max-width: 100%; border-radius: 12px; margin-top: 10px;" controls></video>` :
                            `<img src="${URL.createObjectURL(file)}" style="max-width: 100%; border-radius: 12px; margin-top: 10px;">`
                        }
                            <button id="removeAfterglowMediaBtn" style="position: absolute; top: 0; right: 0; background: #ff4757; color: white; border: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; z-index: 10;">&times;</button>
                        </div>
                    `;
                    document.getElementById('removeAfterglowMediaBtn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        afterglowMediaUpload.value = '';
                        afterglowPreview.innerHTML = '';
                    });
                }
            });
        }

        if (submitAfterglowBtn) {
            const newSubmitAfterglowBtn = submitAfterglowBtn.cloneNode(true);
            submitAfterglowBtn.parentNode.replaceChild(newSubmitAfterglowBtn, submitAfterglowBtn);

            newSubmitAfterglowBtn.addEventListener('click', async () => {
                const caption = afterglowCaption.value.trim();
                const file = afterglowMediaUpload.files[0];

                if (!file) {
                    showNotification('Please select a photo or video for your story', 'warning');
                    return;
                }

                newSubmitAfterglowBtn.disabled = true;
                newSubmitAfterglowBtn.innerHTML = '<span>Sharing...</span> <i class="fas fa-spinner fa-spin"></i>';

                try {
                    await DashboardAPI.createStory({
                        caption,
                        media: file
                    });

                    showNotification('AfterGlow shared!', 'success');
                    afterglowCaption.value = '';
                    afterglowMediaUpload.value = '';
                    afterglowPreview.innerHTML = '';
                    if (typeof hideModal === 'function') hideModal('afterglow');
                    if (window.loadAfterglowStories) window.loadAfterglowStories();
                } catch (error) {
                    console.error('Story creation failed:', error);
                    showNotification('Failed to share AfterGlow', 'error');
                } finally {
                    newSubmitAfterglowBtn.disabled = false;
                    newSubmitAfterglowBtn.innerHTML = '<span>Share AfterGlow!</span> <i class="fas fa-bolt"></i>';
                }
            });
        }

        // ============ USER PROFILE MODAL ============
        window.viewUserProfileFromAPI = async function (userId) {
            console.log(`📱 Loading profile for user ${userId} from API...`);
            try {
                showNotification('Loading profile...', 'info');
                const [user, posts, followers, following] = await Promise.all([
                    DashboardAPI.loadUserProfile(userId),
                    DashboardAPI.loadUserPosts(userId),
                    DashboardAPI.loadFollowers(userId),
                    DashboardAPI.loadFollowing(userId)
                ]);

                const modal = document.createElement('div');
                modal.className = 'modal';
                modal.style.display = 'flex';
                modal.innerHTML = `
                    <div class="modal-content" style="max-width: 500px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column;">
                        <div class="modal-header">
                            <div class="modal-title" style="color: #333;">${user.name}'s Profile</div>
                            <button class="close-modal">&times;</button>
                        </div>
                        <div class="modal-body" style="overflow-y: auto; flex: 1; padding: 20px;">
                            <div style="text-align: center; margin-bottom: 20px;">
                                <img src="${user.avatar || user.avatar_url || '/uploads/avatars/default.png'}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary); margin-bottom: 10px;">
                                <h3 style="color: #333;">${user.name}</h3>
                                <p style="color: var(--primary); font-weight: 600;">@${user.username}</p>
                                <p style="color: #666; font-size: 14px;">
                                    <i class="fas fa-graduation-cap"></i> ${user.campus} • ${user.major} • ${user.year}
                                </p>
                            </div>

                            <div style="display: flex; justify-content: center; gap: 30px; margin-bottom: 20px; text-align: center;">
                                <div style="cursor: pointer;" id="showFollowersBtn">
                                    <div style="font-weight: bold; font-size: 18px; color: #333;">${followers.length}</div>
                                    <div style="font-size: 12px; color: #999;">Followers</div>
                                </div>
                                <div style="cursor: pointer;" id="showFollowingBtn">
                                    <div style="font-weight: bold; font-size: 18px; color: #333;">${following.length}</div>
                                    <div style="font-size: 12px; color: #999;">Following</div>
                                </div>
                                <div>
                                    <div style="font-weight: bold; font-size: 18px; color: #333;">${posts.length}</div>
                                    <div style="font-size: 12px; color: #999;">Posts</div>
                                </div>
                            </div>

                            <div style="background: #f8f9fa; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                                <h4 style="font-size: 14px; text-transform: uppercase; color: #999; margin-bottom: 8px;">Bio</h4>
                                <p style="line-height: 1.5; color: #555;">${user.bio || 'No bio yet.'}</p>
                            </div>

                            <div style="margin-bottom: 20px;">
                                <h4 style="font-size: 14px; text-transform: uppercase; color: #999; margin-bottom: 15px;">Posts</h4>
                                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                                    ${posts.length === 0 ? '<p style="grid-column: span 3; text-align: center; color: #999;">No posts yet.</p>' :
                        posts.map(post => `
                                        <div style="aspect-ratio: 1; border-radius: 8px; overflow: hidden; position: relative; cursor: pointer;">
                                            ${post.media ? `<img src="${post.media}" style="width: 100%; height: 100%; object-fit: cover;">` :
                                `<div style="width:100%; height:100%; background:#eee; display:flex; align-items:center; justify-content:center; padding:10px; font-size:10px; overflow:hidden; color: #333;">${post.caption}</div>`}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                        <div style="padding: 15px; border-top: 1px solid var(--border); display: flex; gap: 10px;">
                            <button class="btn btn-primary" style="flex: 1;" id="profileFollowBtn">
                                <i class="fas fa-user-plus"></i> Follow
                            </button>
                            <button class="btn" style="flex: 1;" id="profileMessageBtn">
                                <i class="fas fa-paper-plane"></i> Message
                            </button>
                        </div>
                    </div>
                `;

                document.body.appendChild(modal);

                modal.querySelector('#showFollowersBtn').onclick = () => showUserListModal('Followers', followers);
                modal.querySelector('#showFollowingBtn').onclick = () => showUserListModal('Following', following);

                modal.querySelector('#profileFollowBtn').onclick = async () => {
                    await followUserFromAPI(userId);
                    document.body.removeChild(modal);
                    viewUserProfileFromAPI(userId);
                };

                modal.querySelector('#profileMessageBtn').onclick = () => {
                    document.body.removeChild(modal);
                    startChat({ id: user.id, name: user.name, avatar: user.avatar });
                };

                modal.addEventListener('click', (e) => {
                    if (e.target === modal || e.target.classList.contains('close-modal')) {
                        document.body.removeChild(modal);
                    }
                });
            } catch (error) {
                console.error('Failed to view profile:', error);
                showNotification('Failed to load profile', 'error');
            }
        };

        window.showUserListModal = function (title, users) {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.style.zIndex = '2000';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 400px; max-height: 70vh; display: flex; flex-direction: column;">
                    <div class="modal-header">
                        <div class="modal-title" style="color: #333;">${title} (${users.length})</div>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body" style="overflow-y: auto; flex: 1; padding: 15px;">
                        ${users.length === 0 ? `<p style="text-align:center; color:#999; padding:20px;">No students found.</p>` :
                    users.map(u => `
                            <div style="display: flex; align-items: center; gap: 12px; padding: 10px; border-bottom: 1px solid #eee; cursor: pointer;" class="user-list-item" data-id="${u.id}">
                                <img src="${u.avatar || u.avatar_url || '/uploads/avatars/default.png'}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; color: #333;">${u.name}</div>
                                    <div style="font-size: 12px; color: #666;">@${u.username}</div>
                                </div>
                                <i class="fas fa-chevron-right" style="color: #ccc; font-size: 12px;"></i>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            modal.querySelectorAll('.user-list-item').forEach(item => {
                item.onclick = () => {
                    const userId = item.getAttribute('data-id');
                    document.body.removeChild(modal);
                    viewUserProfileFromAPI(userId);
                };
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal || e.target.classList.contains('close-modal')) {
                    document.body.removeChild(modal);
                }
            });
        };

        // ============ OVERRIDE CREATE POST ELEMENT ============
        window.createPostElement = function (post) {
            const timeAgo = (dateStr) => {
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return 'Recently';
                const now = new Date();
                const seconds = Math.floor((now - date) / 1000);
                if (seconds < 60) return 'Just now';
                const minutes = Math.floor(seconds / 60);
                if (minutes < 60) return `${minutes}m ago`;
                const hours = Math.floor(minutes / 60);
                if (hours < 24) return `${hours}h ago`;
                const days = Math.floor(hours / 24);
                if (days < 7) return `${days}d ago`;
                return date.toLocaleDateString();
            };

            const postEl = document.createElement('div');
            postEl.className = 'post-card';
            postEl.dataset.postId = post.post_id || post.id;

            const displayTime = (post.created_at || post.timestamp) ? timeAgo(post.created_at || post.timestamp) : 'Just now';
            let bufCaption = post.content || post.caption || '';
            if (bufCaption === 'undefined' || bufCaption === 'null') bufCaption = '';
            const fullCaption = bufCaption;
            const isLongCaption = fullCaption.length > 300;
            const displayCaption = isLongCaption ? fullCaption.substring(0, 300) + '...' : fullCaption;
            const isLiked = post.isLiked || post.user_has_liked || post.is_sparked || false;
            const isSaved = post.isSaved || post.user_has_saved || post.is_saved || false;
            const sparks = parseInt(post.sparks || post.spark_count || 0);
            const comments = parseInt(post.comments || post.comment_count || 0);
            const username = post.isAnonymous ? 'Anonymous Student' : (post.name || post.username || post.user_name || 'Sparkler');
            const avatarUrl = post.avatar || post.avatar_url || '/uploads/avatars/default.png';
            const mediaUrl = post.media || post.media_url || null;

            // 1. HEADER
            const headerHtml = `
                <div class="post-header">
                    <img src="${avatarUrl}" alt="${username}"
                        class="post-avatar" onerror="this.onerror=null;this.src='/uploads/avatars/default.png';">
                    <div class="post-author-info">
                        <div class="post-username-row">
                            <div class="post-username">@${username}</div>
                            ${post.is_verified ? '<span style="color: #3b82f6; font-size: 12px; margin-left: 4px;"><i class="fas fa-check-circle"></i></span>' : ''}
                        </div>
                        <div class="post-meta-row">
                            <span>${post.campus || 'Main Campus'}</span>
                            ${post.location ? ` • <i class="fas fa-map-marker-alt" style="font-size: 10px; color: var(--primary);"></i> ${post.location}` : ''} •
                            <span class="post-time-simple">${displayTime}</span>
                        </div>
                    </div>
                    <button class="post-options-btn" onclick="event.stopPropagation(); window.showPostMenu('${post.post_id || post.id}', this)">
                        <i class="fas fa-ellipsis-h"></i>
                    </button>
                </div>
            `;

            // 2. TEXT (with hashtag/mention linkification)
            let processedCaption = fullCaption
                .replace(/#(\w+)/g, '<a href="#" class="hashtag" style="color: var(--primary); text-decoration: none; font-weight: 600;">#$1</a>')
                .replace(/@(\w+)/g, '<a href="#" class="mention" style="color: #3b82f6; text-decoration: none; font-weight: 600;">@$1</a>');

            const isLongText = fullCaption.length > 280;
            const textHtml = fullCaption ? `
                <div class="post-text-body">
                    <div class="post-caption-container">
                        <div class="post-caption-preview ${isLongText ? 'has-fade' : ''}" id="caption-${post.post_id || post.id}">
                            ${processedCaption}
                        </div>
                        ${isLongText ? `<div class="see-more-link" onclick="window.togglePostExpansion('${post.post_id || post.id}', this)">See More</div>` : ''}
                    </div>
                </div>
            ` : '';

            // 3. MEDIA (Full Bleed & Carousel Support)
            let mediaHtml = '';
            const media_files = post.media_files || [];

            if (media_files.length > 0) {
                if (media_files.length === 1) {
                    const m = media_files[0];
                    const isVideo = m.type === 'video' || m.url.match(/\.(mp4|webm|ogg|mov)$/i);
                    mediaHtml = `
                        <div class="post-media-proper">
                            ${isVideo ?
                            `<video class="media-obj-proper" src="${m.url}" controls preload="metadata"></video>` :
                            `<img class="media-obj-proper" src="${m.url}" alt="Post media" loading="lazy">`
                        }
                        </div>
                    `;
                } else {
                    // Simple Scrollable Carousel for Multi-media
                    mediaHtml = `
                        <div class="post-media-proper carousel-container" style="position: relative;">
                            <div class="media-carousel-scroll" style="display: flex; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none;">
                                ${media_files.map((m, idx) => {
                        const isVideo = m.type === 'video' || m.url.match(/\.(mp4|webm|ogg|mov)$/i);
                        return `
                                        <div class="carousel-item" style="flex: 0 0 100%; scroll-snap-align: start; position: relative;">
                                            ${isVideo ?
                                `<video class="media-obj-proper" src="${m.url}" controls preload="metadata" style="width: 100%; display: block;"></video>` :
                                `<img class="media-obj-proper" src="${m.url}" alt="Media ${idx + 1}" loading="lazy" style="width: 100%; display: block;">`
                            }
                                            <div style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.6); color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px;">
                                                ${idx + 1}/${media_files.length}
                                            </div>
                                        </div>
                                    `;
                    }).join('')}
                            </div>
                        </div>
                    `;
                }
            } else if (mediaUrl) {
                // Fallback for legacy posts or single mediaUrl field
                const isVideo = mediaUrl.match(/\.(mp4|webm|ogg|mov)$/i);
                mediaHtml = `
                    <div class="post-media-proper">
                        ${isVideo ?
                        `<video class="media-obj-proper" src="${mediaUrl}" controls preload="metadata"></video>` :
                        `<img class="media-obj-proper" src="${mediaUrl}" alt="Post media" loading="lazy">`
                    }
                    </div>
                `;
            }

            // 4. INTERACTION AREA
            const footerAreaHtml = `
                <div class="post-interaction-metrics">
                    <div class="metric-stat spark-stat">
                        <i class="fas fa-fire" style="color: #ff5722;"></i>
                        <span class="spark-count-val">${isNaN(sparks) ? 0 : sparks}</span> Sparks
                    </div>
                    <div class="metric-stat comment-stat">
                        <i class="far fa-comment"></i>
                        <span class="comment-count-val">${isNaN(comments) ? 0 : comments}</span> Comments
                    </div>
                </div>

                <div class="post-interaction-actions">
                    <button class="action-btn-custom spark ${isLiked ? 'active' : ''}"
                        onclick="event.stopPropagation(); window.toggleSpark('${post.post_id || post.id}', this)">
                        <i class="${isLiked ? 'fas' : 'far'} fa-fire" style="${isLiked ? 'color: #ff5722;' : ''}"></i>
                        <span>Spark</span>
                    </button>

                    <button class="action-btn-custom comment" onclick="event.stopPropagation(); window.location.href='/post/${post.post_id || post.id}'">
                        <i class="far fa-comment"></i>
                        <span>Comment</span>
                    </button>

                    <button class="action-btn-custom share" onclick="event.stopPropagation(); window.shareManager?.openShareSheet('post', '${post.post_id || post.id}') || showNotification('Share coming soon!', 'info')">
                        <i class="far fa-share-square"></i>
                        <span>Share</span>
                    </button>

                    <button class="action-btn-custom save ${isSaved ? 'active' : ''}"
                        onclick="event.stopPropagation(); window.toggleSavePost('${post.post_id || post.id}', this)">
                        <i class="${isSaved ? 'fas' : 'far'} fa-bookmark"></i>
                        <span>Save</span>
                    </button>
                </div>
            `;

            // 5. FOOTNOTE (Quick Comment)
            const footnoteHtml = `
                <div class="post-footer-minimal">
                    <div class="post-comment-quick">
                        <img src="${window.appState?.currentUser?.avatar || '/uploads/avatars/default.png'}" 
                            class="post-avatar" style="width: 32px !important; height: 32px !important;" onerror="this.onerror=null;this.src='/uploads/avatars/default.png';">
                        <input type="text" id="comment-input-${post.post_id || post.id}" class="comment-input-min" placeholder="Add a comment..."
                            onkeypress="if(event.key === 'Enter') window.addComment('${post.post_id || post.id}', this)">
                    </div>
                    <div class="comments-section" id="comments-${post.post_id || post.id}" style="display: none;"></div>
                </div>
            `;

            postEl.innerHTML = headerHtml + textHtml + mediaHtml + footerAreaHtml + footnoteHtml;

            if (!window.deletePostConfirm) {
                window.deletePostConfirm = async (postId, btn) => {
                    if (confirm('Are you sure you want to delete this post?')) {
                        try {
                            await DashboardAPI.deletePost(postId);
                            const card = btn.closest('.post-card');
                            if (card) {
                                card.style.opacity = '0.5';
                                card.style.pointerEvents = 'none';
                                setTimeout(() => card.remove(), 500);
                            }
                            showNotification('Post deleted', 'success');
                        } catch (err) {
                            showNotification('Failed to delete post', 'error');
                        }
                    }
                }
            }

            return postEl;
        };

        // ============ PREMIUM POST STYLING ============
        (function injectPremiumPostStyles() {
            const style = document.createElement('style');
            style.textContent = `
                :root {
                    --spark-orange: #ff5722;
                    --spark-glow: rgba(255, 87, 34, 0.3);
                    --premium-shadow: 0 10px 40px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.02);
                    --premium-hover-shadow: 0 20px 50px rgba(233,30,99,0.08);
                }

                /* Premium Card Base */
                .post-card {
                    background: #fff;
                    border-radius: 24px;
                    margin: 16px 0;
                    width: 100%;
                    max-width: 100%;
                    box-shadow: var(--premium-shadow);
                    border: 1px solid rgba(0,0,0,0.05);
                    overflow: hidden;
                    transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
                    position: relative;
                }

                .post-card:hover {
                    box-shadow: var(--premium-hover-shadow);
                    border-color: rgba(233,30,99,0.1);
                }

                /* Header with Glassmorphism */
                .post-header {
                    padding: 14px 20px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: rgba(255, 255, 255, 0.85);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    border-bottom: 1px solid rgba(0,0,0,0.03);
                    position: relative;
                }

                .post-avatar {
                    width: 46px;
                    height: 46px;
                    border-radius: 14px !important;
                    object-fit: cover;
                    border: 2px solid #fff;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.05);
                }

                .post-author-info {
                    flex: 1;
                    min-width: 0;
                }

                .post-username {
                    font-weight: 800;
                    color: #1e293b;
                    font-size: 15px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .post-meta-row {
                    font-size: 11px;
                    color: #94a3b8;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-weight: 600;
                }

                /* Positioning for Options Button */
                .post-options-btn {
                    background: none;
                    border: none;
                    color: #94a3b8;
                    padding: 8px;
                    cursor: pointer;
                    border-radius: 50%;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .post-options-btn:hover {
                    background: #f1f5f9;
                    color: #1e293b;
                }

                /* Content & Body */
                .post-text-body {
                    padding: 12px 20px;
                    font-size: 15px;
                    line-height: 1.6;
                    color: #334155;
                }

                .hashtag {
                    color: #6366f1;
                    font-weight: 700;
                    text-decoration: none;
                }

                .mention {
                    color: #a855f7;
                    font-weight: 700;
                    text-decoration: none;
                }

                .post-caption-preview {
                    position: relative;
                }

                .post-caption-preview.has-fade {
                    max-height: 120px;
                    overflow: hidden;
                    mask-image: linear-gradient(to bottom, black 70%, transparent 100%);
                    -webkit-mask-image: linear-gradient(to bottom, black 70%, transparent 100%);
                }

                .see-more-link {
                    display: inline-block;
                    margin-top: 4px;
                    color: var(--accent);
                    font-weight: 700;
                    font-size: 13px;
                    cursor: pointer;
                }

                /* Media & Carousel Improvements */
                .post-media-proper {
                    margin: 4px 0;
                    background: #f1f5f9;
                    position: relative;
                    width: 100%;
                    overflow: hidden;
                }

                .media-obj-proper {
                    width: 100%;
                    display: block;
                    object-fit: contain;
                    max-height: 600px;
                    background: #000;
                }

                .media-carousel-scroll {
                    display: flex;
                    overflow-x: auto;
                    scroll-snap-type: x mandatory;
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                }

                .media-carousel-scroll::-webkit-scrollbar {
                    display: none;
                }

                .carousel-item {
                    flex: 0 0 100%;
                    scroll-snap-align: start;
                    position: relative;
                }

                /* Interaction Area */
                .post-interaction-metrics {
                    padding: 12px 20px;
                    display: flex;
                    gap: 16px;
                    border-top: 1px solid #f8fafc;
                    font-size: 13px;
                    color: #64748b;
                    font-weight: 600;
                }

                .post-interaction-actions {
                    padding: 8px 16px;
                    display: flex;
                    gap: 12px;
                    border-top: 1px solid #f1f5f9;
                }

                .action-btn-custom {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    border: none;
                    background: transparent;
                    cursor: pointer;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 14px;
                    color: #64748b;
                    transition: all 0.2s;
                }

                .action-btn-custom:hover {
                    background: #f1f5f9;
                    color: #1e293b;
                }

                .action-btn-custom.spark.active {
                    color: var(--spark-orange);
                    background: rgba(255, 87, 34, 0.05);
                }

                .action-btn-custom.save.active {
                    color: #3b82f6;
                    background: rgba(59, 130, 246, 0.05);
                }

                /* Footer */
                .post-footer-minimal {
                    padding: 16px 20px;
                    background: #f8fafc;
                    border-top: 1px solid #f1f5f9;
                }

                .comment-input-min {
                    flex: 1;
                    padding: 10px 16px;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 14px;
                    background: #fff;
                    font-size: 14px;
                    outline: none;
                    transition: all 0.2s;
                }

                .comment-input-min:focus {
                    border-color: var(--accent);
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
                }

                /* Mobile Optimization */
                @media (max-width: 768px) {
                    .post-card {
                        margin: 8px 0;
                        border-radius: 0;
                        border-left: none;
                        border-right: none;
                    }
                    .action-btn-custom span {
                        display: none; /* Icon only on mobile for space */
                    }
                    .action-btn-custom {
                        padding: 10px;
                    }
                }
            `;
            document.head.appendChild(style);
        })();

        // ============ PREMIUM INTERACTION HANDLERS ============
        window.toggleSpark = window.sparkPost = async function (postId, button) {
            console.log(`🔥 Sparking post ${postId}...`);
            try {
                // Optimistic UI
                const card = button.closest('.post-card');
                const sparkCount = card ? card.querySelector('.spark-count-val') : null;
                const icon = button.querySelector('i');
                const isSparking = !button.classList.contains('active');
                let count = sparkCount ? parseInt(sparkCount.textContent) || 0 : 0;

                // Update UI immediately (optimistic)
                if (isSparking) {
                    button.classList.add('active');
                    if (icon) {
                        icon.className = 'fas fa-fire';
                        icon.style.color = '#ff5722';
                    }
                    if (sparkCount) sparkCount.textContent = count + 1;

                    // Animation
                    if (window.createSparkAnimation) {
                        const rect = button.getBoundingClientRect();
                        window.createSparkAnimation(rect.left + rect.width / 2, rect.top);
                    }
                } else {
                    button.classList.remove('active');
                    if (icon) {
                        icon.className = 'far fa-fire';
                        icon.style.color = '';
                    }
                    if (sparkCount) sparkCount.textContent = Math.max(0, count - 1);
                }

                const result = await DashboardAPI.sparkPost(postId);
                console.log('✅ Spark result:', result);

                if (result.action === 'sparked') {
                    showNotification('Post sparked! 🔥', 'success');
                }
            } catch (error) {
                console.error('❌ Spark error:', error);
                showNotification('Failed to spark post.', 'error');
                // Revert UI on error
                location.reload(); // Hard revert for safety
            }
        };

        window.toggleSavePost = window.savePost = async function (postId, button) {
            console.log(`🔖 Saving post ${postId}...`);
            try {
                const result = await DashboardAPI.savePost(postId);
                const icon = button.querySelector('i');
                const text = button.querySelector('span');

                if (result.action === 'saved') {
                    button.classList.add('active');
                    if (icon) icon.className = 'fas fa-bookmark';
                    if (text) text.textContent = 'Saved';
                    showNotification('Post saved! 🔖', 'success');
                } else {
                    button.classList.remove('active');
                    if (icon) icon.className = 'far fa-bookmark';
                    if (text) text.textContent = 'Save';
                }
            } catch (error) {
                console.error('❌ Save error:', error);
                showNotification('Failed to save post.', 'error');
            }
        };

        window.addComment = async function (postId, input) {
            const content = input?.value.trim() || document.getElementById(`comment-input-${postId}`)?.value.trim();
            if (!content) return;

            console.log(`💬 Adding comment to post ${postId}...`);
            try {
                const result = await DashboardAPI.postComment(postId, content);

                // Update count in UI
                const card = (input || document.getElementById(`comment-input-${postId}`)).closest('.post-card');
                const commentCount = card ? card.querySelector('.comment-count-val') : null;
                if (commentCount) {
                    commentCount.textContent = (parseInt(commentCount.textContent) || 0) + 1;
                }

                // Clear input
                if (input) input.value = '';
                const mainInput = document.getElementById(`comment-input-${postId}`);
                if (mainInput) mainInput.value = '';

                showNotification('Comment posted!', 'success');
            } catch (err) {
                console.error('❌ Comment error:', err);
                showNotification('Failed to post comment', 'error');
            }
        };

        // ============ CHAT HISTORY INTEGRATION ============
        window.startChat = async function (contact) {
            console.log(`💬 Starting chat with ${contact.name}...`);

            const messagesContainer = document.getElementById('chatMessages');
            if (!messagesContainer) return;

            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.style.zIndex = '3000';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px; height: 80vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; border-radius: 20px;">
                    <div class="modal-header" style="padding: 15px 20px; border-bottom: 1px solid var(--border); background: white;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <img src="${contact.avatar || contact.avatar_url || '/uploads/avatars/default.png'}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary);">
                            <div>
                                <div style="font-weight: bold; font-size: 16px; color: #333;">${contact.name}</div>
                                <div style="font-size: 12px; color: var(--success); display: flex; align-items: center; gap: 4px;">
                                    <span style="width: 8px; height: 8px; background: #4CAF50; border-radius: 50%;"></span> Online
                                </div>
                            </div>
                        </div>
                        <button class="close-modal" id="closeChatBtn" style="font-size: 24px; background: none; border: none; cursor: pointer; color: #666;">&times;</button>
                    </div>
                    <div id="chatMessages" class="modal-body" style="flex: 1; overflow-y: auto; padding: 20px; background: #f0f2f5;">
                        <div style="text-align:center; padding:20px; color:#999;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>
                    </div>
                    <div class="modal-footer" style="padding: 15px 20px; border-top: 1px solid var(--border); background: white;">
                        <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
                            <button id="anonToggleBtn" style="background: #f0f0f0; border: none; padding: 5px 12px; border-radius: 15px; font-size: 12px; color: #666; cursor: pointer;">
                                <i class="fas fa-mask"></i> Send Anonymously: <span id="anonStatus">OFF</span>
                            </button>
                        </div>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <input type="text" id="chatMessageInput" class="form-control" placeholder="Type your message..." 
                                   style="border-radius: 25px; height: 45px; padding: 0 20px; border: 1px solid #ddd; flex: 1; color: #333;">
                            <button id="sendChatBtn" class="btn btn-primary" style="border-radius: 50%; width: 45px; height: 45px; padding: 0; display: flex; align-items: center; justify-content: center; transform: rotate(45deg);">
                                <i class="fas fa-paper-plane" style="margin-left: -3px; margin-top: -3px;"></i>
                            </button>
                        </div>
                    </div>
                    </div>
                </div>
        `;
            document.body.appendChild(modal);

            const closeBtn = modal.querySelector('#closeChatBtn');
            const sendBtn = modal.querySelector('#sendChatBtn');
            const input = modal.querySelector('#chatMessageInput');
            const anonBtn = modal.querySelector('#anonToggleBtn');
            const anonStatus = modal.querySelector('#anonStatus');

            let isAnonMode = contact.isAnonymous || false;
            if (isAnonMode) {
                anonStatus.textContent = 'ON';
                anonBtn.style.background = '#6610f2';
                anonBtn.style.color = 'white';
            }

            anonBtn.onclick = () => {
                isAnonMode = !isAnonMode;
                anonStatus.textContent = isAnonMode ? 'ON' : 'OFF';
                anonBtn.style.background = isAnonMode ? '#6610f2' : '#f0f0f0';
                anonBtn.style.color = isAnonMode ? 'white' : '#666';
            };

            closeBtn.onclick = () => modal.remove();
            modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

            sendBtn.onclick = () => sendMessageToUser(contact.id, contact.chat_session_id, isAnonMode);
            input.onkeypress = (e) => { if (e.key === 'Enter') sendMessageToUser(contact.id, contact.chat_session_id, isAnonMode); };

            input.focus();

            if (contact.chat_session_id) {
                await renderChatHistory(contact.chat_session_id);
            } else if (contact.id || contact.username) {
                const chats = await DashboardAPI.loadChats();
                const existing = chats.find(c => c.other_user === contact.username || c.other_name === contact.name);
                if (existing) {
                    contact.chat_session_id = existing.chat_session_id;
                    await renderChatHistory(existing.chat_session_id);
                } else {
                    const messagesContainer = document.getElementById('chatMessages');
                    if (messagesContainer) messagesContainer.innerHTML = `<div style="text-align:center; padding:20px; color:#999;">Start a conversation with ${contact.name}!</div>`;
                }
            }
        };

        window.renderChatHistory = async function (sessionId) {
            const messagesContainer = document.getElementById('chatMessages');
            if (!messagesContainer) return;

            try {
                const history = await DashboardAPI.loadChatHistory(sessionId);
                messagesContainer.innerHTML = '';

                if (history.length === 0) {
                    messagesContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">No previous messages.</div>';
                } else {
                    history.forEach(msg => {
                        const isMe = msg.senderUsername === currentUsername;
                        const messageEl = document.createElement('div');
                        messageEl.style.marginBottom = '15px';
                        messageEl.style.display = 'flex';
                        messageEl.style.flexDirection = isMe ? 'row-reverse' : 'row';
                        messageEl.style.alignItems = 'flex-end';
                        messageEl.style.gap = '8px';

                        messageEl.innerHTML = `
                            ${!isMe ? `<img src="${msg.senderAvatar || msg.avatar_url || '/uploads/avatars/default.png'}" style="width: 30px; height: 30px; border-radius: 50%; align-self: flex-start;">` : ''}
    <div style="background: ${isMe ? 'linear-gradient(45deg, var(--primary), var(--secondary))' : '#f0f0f0'}; 
                                        color: ${isMe ? 'white' : '#333'}; 
                                        padding: 10px 15px; border-radius: 18px; max-width: 70%;
                                        ${isMe ? 'border-bottom-right-radius: 5px;' : 'border-bottom-left-radius: 5px;'}">
        ${msg.is_anonymous && !isMe ? `<div style="font-size: 10px; opacity: 0.7; margin-bottom: 4px;"><i class="fas fa-mask"></i> Anonymous student</div>` : ''}
        ${msg.is_anonymous && isMe ? `<div style="font-size: 10px; opacity: 0.7; margin-bottom: 4px;"><i class="fas fa-mask"></i> Sent anonymously</div>` : ''}
        <div>${msg.content || msg.text || ''}</div>
        <div style="font-size: 11px; color: ${isMe ? 'rgba(255,255,255,0.8)' : '#999'}; text-align: right; margin-top: 5px;">
            ${msg.timestamp || new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
    </div>
    `;
                        messagesContainer.appendChild(messageEl);
                    });
                }
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } catch (error) {
                console.error('Failed to load chat history:', error);
                showNotification('Failed to load chat history', 'error');
            }
        };

        window.sendMessageToUser = async function (recipientId, sessionId = null, isAnonymous = false) {
            const input = document.querySelector('#chatMessageInput');
            const content = input?.value.trim();
            if (!content) return;

            try {
                const result = await DashboardAPI.sendMessage({
                    recipient_id: recipientId,
                    chat_session_id: sessionId,
                    content: content,
                    is_anonymous: isAnonymous
                });

                if (input) input.value = '';

                if (result.chat_session_id) {
                    await renderChatHistory(result.chat_session_id);
                }

                loadChatsFromAPI();
            } catch (error) {
                console.error('Failed to send message:', error);
                showNotification('Failed to send message', 'error');
            }
        };

        window.startChatWithUser = async (userId) => {
            console.log('📱 Fetching user info to start chat:', userId);
            try {
                const user = await DashboardAPI.loadUserProfile(userId);
                startChat({ id: user.id || userId, name: user.name || 'Student', avatar: user.avatar, username: user.username });
            } catch (e) {
                console.error('Failed to start chat with user profile:', e);
                startChat({ id: userId, name: 'Student' });
            }
        };

        document.getElementById('newMessageBtn')?.addEventListener('click', () => {
            const query = prompt("Enter username or name to find student:");
            if (query) {
                window.loadConnectUsers(query);
                window.switchPage('connect');
            }
        });

        // ============ OVERRIDE MARKETPLACE LOADING ============
        window.loadMarketplace = async function (category = 'all') {
            const user = JSON.parse(localStorage.getItem('sparkleUser') || '{}');
            const userCampus = localStorage.getItem('sparkleUserCampus') || user.campus || 'all';

            console.log(`📱 Loading marketplace(${category}, campus: ${userCampus}) from API...`);
            const container = document.getElementById('marketplaceContent') || document.getElementById('marketGrid');
            if (!container) {
                console.warn('⚠️ Market container not found');
                return;
            }

            try {
                container.innerHTML = '<div style="grid-column: span 2; text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

                const listings = await DashboardAPI.loadMarketplace(category, userCampus);
                container.innerHTML = '';

                if (!listings || listings.length === 0) {
                    container.innerHTML = `< div style = "grid-column: span 2; text-align: center; padding: 40px; color: #666;" >
                        <i class="fas fa-store-slash" style="font-size: 40px; margin-bottom: 10px; color:#ccc;"></i>
                        <p style="color: #666;">No items found in ${userCampus !== 'all' ? userCampus : 'any campus'}.</p>
                        <button class="btn btn-sm" onclick="window.createListing()" style="margin-top:10px;">Sell Something</button>
                    </div > `;
                    return;
                }

                listings.forEach(item => {
                    const isOwner = item.sellerId === (user.id || user.user_id);
                    const card = document.createElement('div');
                    card.className = 'market-card';
                    card.style = 'background: white; border-radius: 10px; overflow: hidden; border: 1px solid var(--border); display: flex; flex-direction: column; height: 100%;';

                    const imageUrl = (item.images && item.images.length > 0) ? item.images[0] : 'https://via.placeholder.com/300x200?text=No+Image';

                    card.innerHTML = `
    < div style = "position: relative; height: 150px;" >
                            <img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://via.placeholder.com/300x200?text=Image+Error'">
                            ${item.isSold ? '<div style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 2px 8px; border-radius: 5px; font-size: 12px;">SOLD</div>' : ''}
                            <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 5px 10px; background: linear-gradient(to top, rgba(0,0,0,0.7), transparent); color: white; font-size: 12px;">
                                ${item.category || 'Item'}
                            </div>
                        </div>
                        <div style="padding: 12px; flex: 1; display: flex; flex-direction: column; gap: 4px;">
                            <div style="font-weight: bold; font-size: 14px; color: #333;">${item.title}</div>
                            <div style="color: var(--primary, #3498db); font-weight: bold; font-size: 16px;">KSh ${item.price}</div>
                            <div style="font-size: 11px; color: #7f8c8d; margin-top: auto;">
                                <i class="fas fa-map-marker-alt"></i> ${item.campus || 'Global'} • ${item.seller || 'Student'}
                            </div>
                            <div style="margin-top: 10px;">
                                ${isOwner && !item.isSold ?
                            `<button class="btn btn-block" style="width:100%; font-size: 12px; padding: 8px; background:#f1f2f6; border:none; border-radius:5px; cursor:pointer; color: #333;" onclick="markAsSold('${item.id}')">Mark as Sold</button>` :
                            `<button class="btn btn-primary btn-block" style="width:100%; font-size: 12px; padding: 8px; background:var(--primary, #3498db); color:white; border:none; border-radius:5px; cursor:pointer;" onclick="contactSeller('${item.sellerId}', '${item.seller}')" ${item.isSold ? 'disabled' : ''}>${item.isSold ? 'Sold' : 'Contact Seller'}</button>`
                        }
                            </div>
                        </div>
                    `;
                    container.appendChild(card);
                });
            } catch (error) {
                console.error('Failed to load market:', error);
                container.innerHTML = '<div style="grid-column: span 2; text-align: center; padding: 40px; color: red;">Failed to load marketplace items.</div>';
                showNotification('Failed to load marketplace', 'error');
            }
        };

        window.loadMarketplaceContent = window.loadMarketplace;

        window.markAsSold = async function (listingId) {
            try {
                await DashboardAPI.markListingAsSold(listingId);
                showNotification('Item marked as sold!', 'success');
                loadMarketplace();
            } catch (error) {
                showNotification('Failed to update listing', 'error');
            }
        };

        // ============ CREATE LISTING MODAL ============
        window.createListing = function () {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.innerHTML = `
    < div class= "modal-content" style = "max-width: 500px;" >
                    <div class="modal-header">
                        <div class="modal-title" style="color: #333;"><i class="fas fa-tag"></i> Sell Item</div>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label style="color: #333;">Title</label>
                            <input type="text" id="listingTitle" class="form-control" placeholder="What are you selling?">
                        </div>
                        <div class="form-group">
                            <label style="color: #333;">Price (KSh)</label>
                            <input type="number" id="listingPrice" class="form-control" placeholder="e.g. 500">
                        </div>
                        <div class="form-group">
                            <label style="color: #333;">Category</label>
                            <select id="listingCategory" class="form-control">
                                <option value="books">Textbooks</option>
                                <option value="electronics">Electronics</option>
                                <option value="furniture">Furniture</option>
                                <option value="clothing">Clothing</option>
                                <option value="services">Services</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label style="color: #333;">Description</label>
                            <textarea id="listingDescription" class="form-control" rows="3" placeholder="Condition, details, etc."></textarea>
                        </div>
                        <button class="btn btn-primary btn-block" onclick="submitListing()">Post Listing</button>
                    </div>
                </div >
    `;
            document.body.appendChild(modal);
            modal.querySelector('.close-modal').onclick = () => modal.remove();
        };

        window.submitListing = async function () {
            const title = document.getElementById('listingTitle')?.value;
            const price = document.getElementById('listingPrice')?.value;
            const category = document.getElementById('listingCategory')?.value;
            const description = document.getElementById('listingDescription')?.value;

            if (!title || !price || !category || !description) {
                showNotification('Please fill in all fields', 'warning');
                return;
            }

            try {
                showNotification('Posting listing...', 'info');
                const user = JSON.parse(localStorage.getItem('sparkleUser') || '{}');
                await DashboardAPI.createListing({
                    title,
                    description,
                    price,
                    category,
                    campus: user.campus || 'General'
                });
                showNotification('Listing posted!', 'success');
                document.querySelector('.modal').remove();
                if (window.loadMarketplace) window.loadMarketplace();
            } catch (error) {
                console.error(error);
                showNotification('Failed to create listing', 'error');
            }
        };

        // ============ OVERRIDE EVENTS LOADING ============
        window.loadEvents = async function (campus = 'all') {
            console.log(`📱 Loading events for ${campus}...`);
            const container = document.getElementById('eventsContainer') || document.getElementById('eventsContent') || document.getElementById('eventsGrid');

            if (!container) {
                console.warn('⚠️ Events container not found');
                return;
            }

            try {
                container.innerHTML = '<div style="grid-column: span 3; text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

                const events = await DashboardAPI.loadEvents(campus);
                container.innerHTML = '';

                if (!events || events.length === 0) {
                    container.innerHTML = `< div style = "grid-column: span 3; text-align: center; padding: 40px; color: #666;" >
                        <i class="fas fa-calendar-times" style="font-size: 40px; margin-bottom: 10px; color:#ccc;"></i>
                        <p style="color: #666;">No upcoming events found in ${campus !== 'all' ? campus : 'any campus'}.</p>
                        <button class="btn btn-sm" onclick="showModal('createEventModal')" style="margin-top:10px;">Host an Event</button>
                    </div > `;
                    return;
                }

                events.forEach(event => {
                    const el = document.createElement('div');
                    el.className = 'event-card';
                    el.style = "background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.05);";

                    const date = new Date(event.date);
                    const month = date.toLocaleString('default', { month: 'short' });
                    const day = date.getDate();

                    el.innerHTML = `
    < div style = "height: 120px; background: #eee; position: relative;" >
                            <img src="${event.image || 'https://via.placeholder.com/300x150?text=Event'}" style="width:100%; height:100%; object-fit:cover;">
                            <div style="position: absolute; top: 10px; right: 10px; background: white; padding: 5px 12px; border-radius: 8px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                                <div style="font-size: 10px; font-weight: bold; color: var(--primary); text-transform: uppercase;">${month}</div>
                                <div style="font-size: 18px; font-weight: bold; color: #333;">${day}</div>
                            </div>
                        </div>
                        <div style="padding: 15px;">
                            <h3 style="margin: 0 0 5px 0; font-size: 16px; color: #333;">${event.title}</h3>
                            <div style="font-size: 12px; color: #666; margin-bottom: 10px;">
                                <i class="fas fa-clock"></i> ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • 
                                <i class="fas fa-map-marker-alt"></i> ${event.location || 'TBA'}
                            </div>
                            <p style="font-size: 13px; color: #555; margin-bottom: 15px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                                ${event.description || 'No description'}
                            </p>
                            <button class="btn btn-block" style="background: #f0f2f5; color: #333; font-weight: 600;">View Details</button>
                        </div>
`;
                    container.appendChild(el);
                });

            } catch (e) {
                console.error('Failed to load events', e);
                container.innerHTML = '<div style="color:red; text-align:center; padding:20px;">Failed to load events.</div>';
                showNotification('Failed to load events', 'error');
            }
        };

        // ============ OVERRIDE PAGE SWITCHING ============
        const originalSwitchPage = window.switchPage;
        window.switchPage = async function (page) {
            console.log('📱 Switching to page (Dynamic):', page);

            if (typeof originalSwitchPage === 'function') {
                originalSwitchPage(page);
            } else {
                document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
                const target = document.getElementById(page + 'Page');
                if (target) target.classList.remove('hidden');

                document.querySelectorAll('.nav-item').forEach(n => {
                    n.classList.remove('active');
                    if (n.dataset.page === page) n.classList.add('active');
                });
            }

            try {
                if (page === 'home') {
                    console.log('📱 Loading home feed...');
                    if (window.loadFeedPosts) await loadFeedPosts();
                    if (window.loadAfterglowStories) await loadAfterglowStories();

                } else if (page === 'connect') {
                    console.log('📱 Loading connect users...');
                    if (window.loadConnectUsers) await loadConnectUsers();

                } else if (page === 'messages') {
                    console.log('📱 Loading messages...');
                    if (window.loadChatsFromAPI) await loadChatsFromAPI();

                } else if (page === 'groups') {
                    console.log('📱 Loading groups...');
                    if (window.loadGroups) await loadGroups();

                } else if (page === 'moments') {
                    console.log('📱 Loading moments...');
                    if (window.loadMoments) await loadMoments();

                } else if (page === 'market' || page === 'marketplace') {
                    console.log('📱 Loading marketplace...');
                    if (window.loadMarketplace) await loadMarketplace('all');

                } else if (page === 'lostfound' || page === 'lost-found') {
                    console.log('📱 Loading lost & found...');
                    if (window.loadLostFoundContent) await loadLostFoundContent('all');

                } else if (page === 'skills' || page === 'skill-market') {
                    console.log('📱 Loading skill marketplace...');
                    if (window.loadSkillMarketContent) await loadSkillMarketContent('all');

                } else if (page === 'profile') {
                    console.log('📱 Loading profile...');
                    if (window.updateProfileDisplay) await updateProfileDisplay();
                    if (window.switchProfileTab) await switchProfileTab('posts');
                }
            } catch (error) {
                console.error('❌ Error loading page data:', error);
                showNotification('Failed to load page data', 'error');
            }
        };

        // ============ OVERRIDE PROFILE PAGE DISPLAY ============
        window.updateProfileDisplay = async function () {
            const profilePage = document.getElementById('profilePage');
            if (!profilePage) return;

            console.log('📱 Updating Profile Page with real data...');
            try {
                const userId = localStorage.getItem('sparkleUserId') || '1';

                const [user, posts, followers, following] = await Promise.all([
                    DashboardAPI.loadUserProfile(userId),
                    DashboardAPI.loadUserPosts(userId),
                    DashboardAPI.loadFollowers(userId),
                    DashboardAPI.loadFollowing(userId)
                ]);

                const nameEl = document.getElementById('profileName');
                const campusEl = document.getElementById('profileCampus');
                const bioEl = document.getElementById('profileBio');
                const avatarEl = document.getElementById('profileAvatar');

                if (nameEl) nameEl.textContent = user.name;
                if (campusEl) campusEl.innerHTML = `<i class="fas fa-graduation-cap"></i> ${user.campus} • ${user.major || 'Student'} `;
                if (bioEl) bioEl.textContent = user.bio || 'No bio yet.';
                if (avatarEl) avatarEl.src = user.avatar;

                const postsCount = document.getElementById('profilePosts');
                if (postsCount) postsCount.textContent = posts.length;

                profilePage.dataset.posts = JSON.stringify(posts);

                const grid = document.getElementById('profileGrid');
                if (grid) {
                    grid.innerHTML = '';
                    if (posts.length === 0) {
                        grid.innerHTML = '<div style="grid-column: span 3; text-align: center; padding: 40px; color: #999;">No posts yet.</div>';
                    } else {
                        posts.forEach(post => {
                            const item = document.createElement('div');
                            item.className = 'profile-post-item';
                            item.style = 'aspect-ratio: 1; overflow: hidden; border-radius: 10px; position: relative; cursor: pointer; border: 1px solid var(--border);';

                            const content = post.media ?
                                `<img src="${post.media}" style="width: 100%; height: 100%; object-fit: cover;">` :
                                `<div style="width:100%; height:100%; background:#f8f9fa; display:flex; align-items:center; justify-content:center; padding:10px; font-size:12px; color:#333; text-align:center;">${post.caption}</div>`;

                            item.innerHTML = content;
                            grid.appendChild(item);
                        });
                    }
                }
            } catch (error) {
                console.error('Failed to update profile page:', error);
                showNotification('Failed to update profile', 'error');
            }
        };

        window.switchProfileTab = async function (tab) {
            console.log('📱 Switching profile tab:', tab);
            const tabs = document.querySelectorAll('.profile-tab');
            tabs.forEach(t => {
                t.classList.remove('active');
                if (t.dataset.tab === tab) t.classList.add('active');
            });
        };

        // ============ OVERRIDE FEED POSTS LOADING ============
        // keeps exactly FEED_LIMIT posts and refreshes when scrolled past bottom
        const FEED_LIMIT = 12;
        let lastSeenPostId = null;
        let feedLoading = false;
        let suggestionsDisplayed = false; // only fetch once per page load

        // helper to render a list of suggested user cards
        async function fetchAndRenderSuggestions(container) {
            if (suggestionsDisplayed) return;
            suggestionsDisplayed = true; // Set immediately to prevent race conditions

            // Auto-detect container if not provided
            const targetContainer = container || document.getElementById('dashboard-suggestions-sidebar') || document.getElementById('feed');
            if (!targetContainer) return;

            try {
                const users = await DashboardAPI.getSuggestions(5);
                if (!users || users.length === 0) return;

                const sugWrapper = document.createElement('div');
                sugWrapper.className = 'premium-empty-state'; // Reuse premium card logic
                sugWrapper.style.cssText = 'padding:25px; margin:24px 0; max-width: 100%; border-radius: 24px; text-align: left; align-items: flex-start;';
                sugWrapper.innerHTML = `<h4 style="margin-bottom:18px; font-weight: 800; color: #1e293b; font-size: 18px; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-users" style="color: var(--primary); font-size: 20px;"></i> 
                    People you may know
                </h4>`;

                users.forEach(u => {
                    const uel = document.createElement('div');
                    uel.className = 'suggestion-user';
                    uel.style.cssText = 'display:flex; align-items:center; margin-bottom:15px; width: 100%; padding: 8px; border-radius: 12px; transition: background 0.2s;';
                    uel.innerHTML = `
                        <img src="${u.avatar_url || '/uploads/avatars/default.png'}" style="width:44px; height:44px; border-radius:12px; margin-right:12px; object-fit: cover; border: 1px solid #eee;" />
                        <div style="flex:1;">
                            <strong>${u.name || ''}</strong><br>
                            <small>@${u.username || ''}</small>
                        </div>
                        <button class="btn btn-sm btn-primary" style="border-radius:10px; font-weight:700; padding:6px 16px; background:var(--primary-gradient); border:none;" onclick="followUserFromAPI('${u.user_id}', this)">Follow</button>
`;
                    sugWrapper.appendChild(uel);
                });

                // insert suggestions
                if (targetContainer.id === 'dashboard-suggestions-sidebar') {
                    targetContainer.innerHTML = '';
                    targetContainer.appendChild(sugWrapper);
                } else {
                    const insertIndex = Math.min(FEED_LIMIT, targetContainer.children.length);
                    if (insertIndex >= 0 && targetContainer.children.length > 0) {
                        targetContainer.insertBefore(sugWrapper, targetContainer.children[insertIndex]);
                    } else {
                        targetContainer.appendChild(sugWrapper);
                    }
                }
            } catch (err) {
                console.error('Error loading suggestions', err);
            }
        }

        let feedPage = 1;
        let allPostsLoaded = false;

        window.loadFeedPosts = async function (options = {}) {
            const isSilent = options.silent || false;
            const isRefresh = options.refresh || false;
            const container = document.getElementById('feed');
            if (!container) return;

            if (isRefresh) {
                feedPage = 1;
                allPostsLoaded = false;
            }

            if (feedLoading || allPostsLoaded) return;
            feedLoading = true;

            try {
                if (!isSilent && isRefresh) {
                    container.innerHTML = '<div style="text-align:center; padding:40px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
                }

                const posts = await DashboardAPI.loadFeed({ limit: FEED_LIMIT, page: feedPage });
                if (!posts) return;

                if (posts.length < FEED_LIMIT) {
                    allPostsLoaded = true;
                }

                if (isRefresh) {
                    // update lastSeenPostId only on refresh (top of feed)
                    if (posts.length > 0) {
                        lastSeenPostId = posts[0].post_id || posts[0].id;
                    }
                }

                const fragment = document.createDocumentFragment();
                if (posts.length === 0 && feedPage === 1) {
                    const empty = document.createElement('div');
                    empty.className = 'premium-empty-state';
                    empty.innerHTML = `
                        <div class="empty-icon-container">
                            <i class="fas fa-newspaper"></i>
                        </div>
                        <h3>No posts yet</h3>
                        <p>Be the first to share something!</p>
                        <button onclick="window.showCreateOptions()" class="empty-cta-btn">
                            <i class="fas fa-plus"></i> Spark One!
                        </button>
                    `;
                    fragment.appendChild(empty);
                } else {
                    posts.forEach(post => {
                        try {
                            const postEl = window.createPostElement(post);
                            fragment.appendChild(postEl);
                        } catch (e) {
                            console.error('Render error:', e);
                        }
                    });
                }

                if (isRefresh) {
                    // preserve existing suggestions element across refreshes
                    let suggestionsNode = container.querySelector('.profile-suggestions');
                    if (suggestionsNode) {
                        suggestionsNode.remove();
                    }

                    container.innerHTML = '';
                    container.appendChild(fragment);

                    if (suggestionsNode) {
                        // re-insert at roughly same index
                        const insertIndex = Math.min(FEED_LIMIT, container.children.length);
                        if (insertIndex < container.children.length) {
                            container.insertBefore(suggestionsNode, container.children[insertIndex]);
                        } else {
                            container.appendChild(suggestionsNode);
                        }
                    }
                } else {
                    container.appendChild(fragment);
                }

                feedPage++;

                // if the user has already scrolled past half a viewport height, insert suggestions immediately
                if (!suggestionsDisplayed && window.scrollY > window.innerHeight * 0.5) {
                    fetchAndRenderSuggestions(container);
                }

            } catch (error) {
                console.error('❌ Failed to load feed:', error);
                if (!isSilent) {
                    container.innerHTML = `< div style = "text-align:center; padding:40px; color:var(--danger);" > Failed to load feed. < br > <button onclick="window.loadFeedPosts()" class="btn btn-sm" style="margin-top:10px;">Retry</button></div > `;
                    showNotification('Failed to load feed', 'error');
                }
            } finally {
                feedLoading = false;
            }
        };

        // refresh when user scrolls to bottom and also trigger profile suggestions (silent)
        window.addEventListener('scroll', async () => {
            const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 300;
            if (nearBottom && !feedLoading && !allPostsLoaded) {
                await window.loadFeedPosts({ refresh: false, silent: true });
            }

            // trigger suggestions after the user has scrolled more than one viewport
            if (!suggestionsDisplayed && window.scrollY > window.innerHeight * 0.7) {
                const container = document.getElementById('feed');
                if (container) {
                    fetchAndRenderSuggestions(container);
                }
            }
        });

        // poll for new posts every 30s; if new found reload feed silently
        setInterval(async () => {
            try {
                const newest = await DashboardAPI.loadFeed({ limit: 1, page: 1 });
                if (newest.length && newest[0].post_id && newest[0].post_id !== lastSeenPostId) {
                    await window.loadFeedPosts({ refresh: true, silent: true });
                }
            } catch (e) {
                console.error('Feed poll error', e);
            }
        }, 30000);

        // ============ OVERRIDE MESSAGING LOADING ============
        window.loadMessages = async function (type = 'direct') {
            console.log(`📱 Loading ${type} messages...`);
            if (type === 'direct' || type === 'anonymous') {
                await loadChatsFromAPI();
            } else {
                const container = document.getElementById('messagesList');
                if (container) {
                    container.innerHTML = `< div style = "text-align:center; padding:40px; color:#999;" >
                        <i class="fas fa-lock" style="font-size:30px; margin-bottom:10px; color: #ccc;"></i>
                        <br><span style="color: #666;">${type.charAt(0).toUpperCase() + type.slice(1)} messaging coming soon!</span>
                    </div>`;
                }
            }
        };

        // ============ OVERRIDE CONFESSIONS LOADING ============
        window.loadEnhancedConfessions = async function () {
            const container = document.getElementById('confessionsListModal');
            if (!container) return;

            try {
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
                const userCampus = localStorage.getItem('sparkleUserCampus') || JSON.parse(localStorage.getItem('sparkleUser') || '{}').campus;
                const confessions = await DashboardAPI.loadConfessions(userCampus);
                container.innerHTML = '';

                if (confessions.length === 0) {
                    container.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">No confessions yet. Be the first to share!</div>';
                    return;
                }

                confessions.forEach(conf => {
                    const card = document.createElement('div');
                    card.className = 'confession-card';
                    card.innerHTML = `
    < div class="confession-text" style = "color: #333;" > "${conf.text}"</div >
                        <div class="confession-meta" style="color: #666;">
                            <span><i class="fas fa-university"></i> ${conf.campus || 'Campus'}</span>
                            <span>${conf.timestamp}</span>
                        </div>
                        <div class="confession-actions">
                            <button class="confession-action" onclick="reactToConfession('${conf.id}')" style="color: #666;">
                                <i class="fas fa-fire"></i> ${conf.reactions || 0}
                            </button>
                            <button class="confession-action" onclick="showConfessionComments('${conf.id}')" style="color: #666;">
                                <i class="fas fa-comment"></i>
                            </button>
                            <button class="confession-action" onclick="shareConfession('${conf.id}')" style="color: #666;">
                                <i class="fas fa-share-alt"></i>
                            </button>
                        </div>
`;
                    container.appendChild(card);
                });
            } catch (error) {
                console.error('Failed to load confessions:', error);
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--danger);">Failed to load confessions.</div>';
                showNotification('Failed to load confessions', 'error');
            }
        };

        // ============ OVERRIDE POLLS LOADING ============
        window.loadPolls = async function () {
            const container = document.getElementById('activePolls');
            if (!container) return;
            const user = JSON.parse(localStorage.getItem('sparkleUser') || '{}');
            const userCampus = localStorage.getItem('sparkleUserCampus') || user.campus || 'all';

            try {
                container.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i></div>';
                const polls = await DashboardAPI.loadPolls(userCampus);
                container.innerHTML = '';

                if (polls.length === 0) {
                    container.innerHTML = `< div style = "text-align: center; color: #666;" > No active polls in ${userCampus !== 'all' ? userCampus : 'any campus'}.</div > `;
                    return;
                }

                polls.forEach(poll => {
                    const card = document.createElement('div');
                    card.className = 'poll-card';
                    const optionsHtml = poll.options.map((opt) => `
    < div class="poll-option" onclick = "window.votePoll('${poll.id || poll.poll_id}', '${opt.option_id}')" >
                            <div class="poll-option-text" style="color: #333;">${opt.option_text || opt.text}</div>
                            <div class="poll-option-bar" style="width: ${opt.vote_count > 0 ? (Math.round((opt.vote_count / (poll.total_votes || 1)) * 100)) : 0}%"></div>
                            <div class="poll-option-percent" style="color: #666;">${opt.vote_count > 0 ? (Math.round((opt.vote_count / (poll.total_votes || 1)) * 100)) : 0}%</div>
                        </div >
    `).join('');

                    card.innerHTML = `
    < div class="poll-question" style = "color: #333;" > ${poll.question}</div >
                        <div class="poll-options">${optionsHtml}</div>
                        <div class="poll-footer" style="color: #666;">
                            <span><i class="fas fa-users"></i> ${poll.total_votes || 0} votes</span>
                            <span>• Ends in ${poll.time_left || '24h'}</span>
                        </div>
`;
                    container.appendChild(card);
                });
            } catch (error) {
                console.error('Failed to load polls:', error);
                container.innerHTML = '<div style="text-align: center; color: var(--danger);">Failed to load polls.</div>';
                showNotification('Failed to load polls', 'error');
            }
        };

        window.votePoll = async (pollId, optionId) => {
            try {
                await DashboardAPI.votePoll(pollId, optionId);
                showNotification('Vote recorded!', 'success');
                loadPolls();
            } catch (error) {
                console.error('Failed to vote:', error);
                if (error.message.includes('Already voted')) {
                    showNotification('You have already voted on this poll', 'info');
                } else {
                    showNotification('Failed to record vote', 'error');
                }
            }
        };

        // ============ OVERRIDE LOST & FOUND LOADING ============
        window.loadLostFoundContent = async function (type = 'all') {
            const container = document.getElementById('lostFoundItems');
            if (!container) return;
            const user = JSON.parse(localStorage.getItem('sparkleUser') || '{}');
            const userCampus = localStorage.getItem('sparkleUserCampus') || user.campus || 'all';

            try {
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
                const items = await DashboardAPI.loadLostFoundItems(type, userCampus);
                container.innerHTML = '';

                if (items.length === 0) {
                    container.innerHTML = `< div style = "text-align: center; padding: 40px; color: #666;" > No items reported in ${userCampus !== 'all' ? userCampus : 'any campus'}.</div > `;
                    return;
                }

                items.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'lost-card';
                    card.style = 'background: white; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 15px; overflow: hidden;';
                    card.innerHTML = `
    < div style = "padding: 15px;" >
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                                <div class="badge ${item.type === 'lost' ? 'badge-danger' : 'badge-success'}" 
                                     style="background: ${item.type === 'lost' ? '#ff4757' : '#2ed573'}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px;">
                                    ${item.type.toUpperCase()}
                                </div>
                                <div style="font-size: 11px; color: #999;">${DashboardAPI.formatTimestamp(item.timestamp)}</div>
                            </div>
                            <div style="font-weight: 600; margin-bottom: 5px; color: #333;">${item.title}</div>
                            <div style="font-size: 13px; color: #666; margin-bottom: 10px;">${item.description}</div>
                            <div style="font-size: 12px; color: #888; display: flex; align-items: center; gap: 5px;">
                                <i class="fas fa-map-marker-alt"></i> ${item.location || item.campus}
                            </div>
                            <button class="btn btn-block" style="margin-top: 15px; font-size: 12px; width:100%; background: var(--primary); color: white; border: none; padding: 8px; border-radius: 5px; cursor: pointer;" onclick="claimItem('${item.id}')">
                                ${item.type === 'lost' ? 'I found this' : 'This is mine'}
                            </button>
                        </div >
    `;
                    container.appendChild(card);
                });
            } catch (error) {
                console.error('Failed to load lost & found:', error);
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--danger);">Failed to load items.</div>';
                showNotification('Failed to load lost & found', 'error');
            }
        };

        // ============ OVERRIDE SKILL MARKET LOADING ============
        window.loadSkillMarketContent = async function (type = 'all') {
            const container = document.getElementById('availableSkills');
            if (!container) return;
            const user = JSON.parse(localStorage.getItem('sparkleUser') || '{}');
            const userCampus = localStorage.getItem('sparkleUserCampus') || user.campus || 'all';

            try {
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

                const offers = await DashboardAPI.loadSkillOffers(type === 'all' ? null : type, userCampus);
                container.innerHTML = '';

                if (!offers || offers.length === 0) {
                    container.innerHTML = `
    < div style = "text-align: center; padding: 40px; color: #666;" >
                            <i class="fas fa-graduation-cap fa-3x" style="display: block; margin-bottom: 20px; opacity: 0.2; color: #ccc;"></i>
                            <span style="color: #666;">No skill offers found ${userCampus !== 'all' ? 'in ' + userCampus : ''}.</span>
                            <br><small style="color: #999;">Be the first to offer a skill!</small>
                        </div>`;
                    return;
                }

                offers.forEach(offer => {
                    const card = document.createElement('div');
                    card.className = 'skill-card';
                    card.style = 'background: white; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 15px; overflow: hidden;';
                    card.innerHTML = `
    < div style = "padding: 15px;" >
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                                <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--primary, #3498db); color: white; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                                    <i class="fas fa-graduation-cap"></i>
                                </div>
                                <div>
                                    <div style="font-weight: 600; font-size: 14px; color: #333;">${offer.title}</div>
                                    <div style="font-size: 11px; color: #888;">${offer.tutor_name || offer.username || 'Student'}</div>
                                </div>
                            </div>
                            <div style="font-size: 13px; color: #555; margin-bottom: 12px; height: 3.6em; overflow: hidden;">${offer.description}</div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="font-weight: 700; color: var(--primary, #3498db);">KSh ${offer.price || 'Free'}</div>
                                <button class="btn btn-sm btn-primary" style="padding: 5px 15px; font-size: 12px; background: var(--primary); color: white; border: none; border-radius: 5px; cursor: pointer;" onclick="requestSkill('${offer.id}')">Request</button>
                            </div>
                        </div >
    `;
                    container.appendChild(card);
                });
            } catch (error) {
                console.error('Failed to load skill market:', error);
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--danger);">Failed to load offers.</div>';
                showNotification('Failed to load skill offers', 'error');
            }
        };

        window.loadMarketplace = window.loadMarketplaceContent;
        window.loadLostFound = window.loadLostFoundContent;
        window.loadSkillMarket = window.loadSkillMarketContent;

        const userSearchInput = document.getElementById('userSearchInput');
        if (userSearchInput) {
            userSearchInput.addEventListener('input', debounce(() => {
                window.loadConnectUsers();
            }, 500));
        }

        // ============ OVERRIDE MOMENTS LOADING ============
        window.loadMoments = async function () {
            const container = document.getElementById('momentsList') || document.getElementById('momentVideoContainer');
            if (!container) return;

            try {
                console.log('📱 Creating Moments UI...');
                container.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%; color:white;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

                const moments = await DashboardAPI.loadMoments();
                container.innerHTML = '';

                if (moments.length === 0) {
                    container.innerHTML = `
    < div style = "display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: white; text-align: center;" >
                            <i class="fas fa-film" style="font-size: 48px; margin-bottom: 20px; opacity: 0.5; color: #999;"></i>
                            <h3 style="color: #333;">No Moments Yet</h3>
                            <p style="opacity: 0.7; max-width: 300px; margin-bottom: 20px; color: #666;">Be the first to share a moment with your campus!</p>
                            <button class="btn btn-primary" onclick="uploadMoment()" style="background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                                <i class="fas fa-plus"></i> Create Moment
                            </button>
                        </div >
    `;
                    return;
                }

                moments.forEach(moment => {
                    const momentEl = document.createElement('div');
                    momentEl.className = 'moment-video';
                    momentEl.style.height = '100%';
                    momentEl.setAttribute('data-moment-id', moment.id);

                    const videoSrc = moment.video || 'assets/videos/sample1.mp4';

                    momentEl.innerHTML = `
    < video class="moment-video-player" loop playsinline style = "width:100%; height:100%; object-fit:cover;" >
                            <source src="${videoSrc}" type="video/mp4">
                        </video>
                        <div class="moment-overlay">
                            <div class="moment-header">
                                <img src="${moment.avatar}" alt="${moment.name}" class="moment-avatar">
                                <div class="moment-user-info">
                                    <div class="moment-username" style="color: white;">${moment.name}</div>
                                    <div class="moment-campus" style="color: rgba(255,255,255,0.8);">${moment.campus}</div>
                                </div>
                            </div>
                            <div class="moment-caption" style="color: white;">${moment.caption || ''}</div>
                            <div class="moment-stats">
                                <span class="moment-action-btn" style="color: white;"><i class="fas fa-heart"></i> ${moment.likes || 0}</span>
                                <span class="moment-action-btn" style="color: white;"><i class="fas fa-comment"></i> ${moment.comments || 0}</span>
                                <span class="moment-action-btn" style="color: white;"><i class="fas fa-share"></i> Share</span>
                            </div>
                        </div>
`;

                    const video = momentEl.querySelector('video');
                    momentEl.addEventListener('click', () => {
                        if (video.paused) video.play();
                        else video.pause();
                    });

                    container.appendChild(momentEl);
                });

            } catch (error) {
                console.error('Failed to load moments:', error);
                container.innerHTML = '<div style="color:white; text-align:center; padding-top:50%;">Failed to load moments</div>';
                showNotification('Failed to load moments', 'error');
            }
        };

        // ============ OVERRIDE CONNECT USERS LOADING ============
        window.loadConnectUsers = async function (q = '', filterCampus = null, options = {}) {
            const isSilent = options.silent || false;
            const container = document.getElementById('connectContainer');
            if (!container) return;

            try {
                if (!isSilent && !q) {
                    container.innerHTML = '<div style="padding:20px; text-align:center;"><i class="fas fa-spinner fa-spin"></i></div>';
                }

                const currentUserId = (JSON.parse(localStorage.getItem('sparkleUser') || '{}')).id || '';
                const users = await DashboardAPI.searchUsers(q, filterCampus);
                const availableUsers = users.filter(u => u.id !== currentUserId);

                const fragment = document.createDocumentFragment();
                if (availableUsers.length === 0) {
                    const empty = document.createElement('div');
                    empty.style.cssText = 'text-align: center; padding: 40px 20px; color: #999; width: 100%;';
                    empty.innerHTML = `
    < i class="fas fa-users-slash" style = "font-size: 40px; margin-bottom: 15px; color: #ccc;" ></i >
        <p style="color: #666;">No students found matching your search</p>
`;
                    fragment.appendChild(empty);
                } else {
                    availableUsers.forEach(user => {
                        const userEl = document.createElement('div');
                        userEl.className = 'connect-card';
                        userEl.innerHTML = `
    < div class="connect-card-inner" >
                                <div class="connect-avatar-container">
                                    <img src="${user.avatar || '/uploads/avatars/default.png'}" alt="${user.name}" class="connect-avatar">
                                    <div class="status-indicator online"></div>
                                </div>
                                <div class="connect-info">
                                    <div class="connect-name" style="color: #333;">${user.name} @${user.username}</div>
                                    <div class="connect-campus" style="color: #666;"><i class="fas fa-university"></i> ${user.campus || 'Main Campus'}</div>
                                    <div class="connect-bio" style="color: #555;">${user.bio || 'Living the Sparkle life! ✨'}</div>
                                </div>
                                <div class="connect-actions">
                                    <button class="btn btn-primary btn-sm" onclick="window.startChatWithUser('${user.id}')" style="background: var(--primary); color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">
                                        <i class="fas fa-comments"></i> Chat
                                    </button>
                                    <button class="btn btn-outline btn-sm" onclick="window.viewUserProfileFromAPI('${user.id}')" style="background: transparent; color: var(--primary); border: 1px solid var(--primary); padding: 5px 10px; border-radius: 5px; cursor: pointer;">
                                        Profile
                                    </button>
                                </div>
                            </div >
    `;
                        fragment.appendChild(userEl);
                    });
                }

                container.innerHTML = '';
                container.appendChild(fragment);

            } catch (error) {
                console.error('Failed to load users:', error);
                container.innerHTML = '<div style="color: red; text-align:center;">Failed to load users</div>';
                showNotification('Failed to load users', 'error');
            }
        };

        // ============ CUSTOM CHAT LOADING ============
        window.loadChatsFromAPI = async function (filterQuery = '') {
            console.log('📱 Loading chats from API...');

            const listContainer = document.querySelector('.messages-list');
            if (!listContainer) return;

            try {
                if (!filterQuery) listContainer.innerHTML = '<div style="padding:20px; text-align:center;"><i class="fas fa-spinner fa-spin"></i></div>';
                const chats = await DashboardAPI.loadChats();
                console.log(`📱 Loaded ${chats.length} chat sessions`);

                const filteredChats = chats.filter(c => {
                    const queryMatch = !filterQuery ||
                        (c.other_name && c.other_name.toLowerCase().includes(filterQuery.toLowerCase())) ||
                        (c.other_user && c.other_user.toLowerCase().includes(filterQuery.toLowerCase()));

                    if (!queryMatch) return false;

                    const activeTab = document.querySelector('[data-message-type].active')?.getAttribute('data-message-type') || 'all';

                    if (activeTab === 'anonymous') return c.last_message_anonymous === 1;
                    if (activeTab === 'unread') return c.is_read === 0 || c.unread > 0;
                    if (activeTab === 'groups') return c.chat_session_id && (c.chat_session_id.toString().includes('group') || c.is_group);
                    if (activeTab === 'direct') return !c.last_message_anonymous && !(c.chat_session_id && c.chat_session_id.toString().includes('group'));

                    return true;
                });

                if (filteredChats.length === 0) {
                    listContainer.innerHTML = '<div style="padding:40px 20px; text-align:center; color:#999;"><i class="fas fa-comment-slash" style="font-size:32px; display:block; margin-bottom:10px; opacity:0.3; color: #ccc;"></i><span style="color: #666;">No messages found in this category.</span></div>';
                    return;
                }

                listContainer.innerHTML = '';
                filteredChats.forEach(chat => {
                    const el = document.createElement('div');
                    el.className = 'conversation-item-premium';

                    const isAnonymous = chat.last_message_anonymous === 1;
                    const displayName = isAnonymous ? 'Anonymous Student' : (chat.other_name || chat.other_username || chat.other_user || 'Sparkler');
                    const chatAvatar = isAnonymous ? '/uploads/avatars/default.png' : (chat.other_avatar || '/uploads/avatars/default.png');

                    el.onclick = () => {
                        document.querySelectorAll('.conversation-item-premium').forEach(p => p.classList.remove('active'));
                        el.classList.add('active');
                        startChat({
                            chat_session_id: chat.chat_session_id,
                            id: chat.other_user_id || chat.other_user,
                            name: displayName,
                            username: isAnonymous ? 'anonymous' : (chat.other_username || chat.other_user || 'unknown'),
                            avatar: chatAvatar,
                            isAnonymous: isAnonymous
                        });
                    };

                    const lastMsgTime = chat.last_message_time ? new Date(chat.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently';
                    const lastMsgText = isAnonymous ? '<i>[Anonymous Message]</i>' : (chat.last_message_text || chat.last_message || 'Click to view conversation');

                    el.innerHTML = `
    < div class="avatar-container-premium" style = "position: relative;" >
                            <img src="${chatAvatar}" alt="User" class="avatar-premium" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; ${isAnonymous ? 'filter: grayscale(1);' : ''}">
                            ${isAnonymous ? '<div style="position:absolute; bottom:0; right:0; background:#333; color:white; font-size:10px; padding:2px 4px; border-radius:4px;"><i class="fas fa-mask"></i></div>' : ''}
                        </div>
                        <div style="flex: 1;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="font-weight: 600; font-size: 16px; font-family: \'Outfit\'; color: ${isAnonymous ? '#6610f2' : '#333'};">${displayName}</span>
                                <span style="font-size: 11px; color: #999;">${lastMsgTime}</span>
                            </div>
                            <div style="font-size: 13px; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; opacity: 0.8;">
                                ${lastMsgText}
                            </div>
                        </div>
`;
                    listContainer.appendChild(el);
                });
            } catch (e) {
                console.error('Failed to load chats:', e);
                showNotification('Failed to load chats', 'error');
            }
        };

        window.showMarketplace = function (category) {
            window.switchPage('marketplace');
            if (window.loadMarketplace) window.loadMarketplace(category);
        };

        window.showLostFound = async function (type) {
            window.switchPage('lostFound');
            if (window.loadLostFoundContent) await window.loadLostFoundContent(type || 'all');
        };

        window.claimItem = async function (itemId) {
            try {
                await DashboardAPI.claimLostFoundItem(itemId);
                showNotification('Item claimed!', 'success');
                loadLostFoundItems('all');
            } catch (e) {
                console.error(e);
                showNotification('Failed to claim item', 'error');
            }
        };

        window.showSkillMarket = async function (type) {
            window.switchPage('skillMarket');
            if (window.loadSkillMarketContent) await window.loadSkillMarketContent(type || 'all');
        };

        window.requestSkillHelp = async function (offerId, tutorName) {
            const message = prompt(`Send a message to ${tutorName}: `);
            if (!message) return;

            try {
                await DashboardAPI.requestSkill(offerId, message);
                showNotification('Request sent!', 'success');
            } catch (e) {
                console.error(e);
                showNotification('Failed to send request', 'error');
            }
        };

        window.showEnhancedSettings = () => {
            const modal = document.getElementById('enhancedSettingsModal');
            if (modal) modal.style.display = 'flex';
        };

        window.switchEnhancedSetting = (tabId, btn) => {
            document.querySelectorAll('.enhanced-settings-content').forEach(el => el.style.display = 'none');
            const target = document.getElementById(tabId);
            if (target) target.style.display = 'block';

            document.querySelectorAll('.settings-nav-item').forEach(el => el.classList.remove('active'));
            if (btn) btn.classList.add('active');
        };

        window.saveDetailedProfile = async () => {
            const nameInput = document.getElementById('enhanced-edit-name') || document.getElementById('editName');
            const bioInput = document.getElementById('enhanced-edit-bio') || document.getElementById('editBio');
            const campusInput = document.getElementById('enhanced-edit-campus') || document.getElementById('editCampus');

            const name = nameInput?.value;
            const bio = bioInput?.value || '';
            const campus = campusInput?.value;

            if (!name || !campus) {
                showNotification('Name and Campus are required', 'warning');
                return;
            }

            try {
                await DashboardAPI.updateProfile({ name, bio, campus });
                showNotification('Profile updated! Refresh to see changes.', 'success');

                const user = JSON.parse(localStorage.getItem('sparkleUser') || '{}');
                user.name = name;
                user.bio = bio;
                user.campus = campus;
                localStorage.setItem('sparkleUser', JSON.stringify(user));
                localStorage.setItem('sparkleUserCampus', campus);

                if (window.loadFeedPosts) window.loadFeedPosts();
            } catch (e) {
                console.error(e);
                showNotification('Failed to update profile', 'error');
            }
        };

        window.showConfessionsGallery = async function () {
            try {
                showNotification('Loading confessions...', 'info');

                const confessions = await DashboardAPI.loadConfessions();

                const existing = document.getElementById('confessionsModal');
                if (existing) existing.remove();

                const modal = document.createElement('div');
                modal.id = 'confessionsModal';
                modal.className = 'modal';
                modal.style.display = 'flex';
                modal.innerHTML = `
                <div class="modal-content" style="max-height:80vh; overflow-y:auto; max-width:500px;">
                        <div class="modal-header">
                            <div class="modal-title" style="color: #333;"><i class="fas fa-user-secret"></i> Anonymous Confessions</div>
                            <button class="close-modal">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div style="background:#f0f2f5; padding:15px; border-radius:10px; margin-bottom:20px; text-align:center; font-style:italic; color:#666;">
                                "Secrets are safe here..."
                            </div>
                            <div id="confessionsList">
                                ${confessions.map(c => `
                                    <div style="background:white; border:1px solid #ddd; padding:15px; border-radius:10px; margin-bottom:10px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                                        <div style="font-size:15px; line-height:1.5; color: #333;">"${c.content || c.text}"</div>
                                        <div style="display:flex; justify-content:space-between; margin-top:10px;font-size:12px;color:#999;">
                                            <span><i class="fas fa-graduation-cap"></i> ${c.campus || 'Campus'}</span>
                                            <span>${c.rating_count !== undefined ? c.rating_count : (c.reactions !== undefined ? c.reactions : 0)} <i class="fas fa-fire" style="color:orange;"></i></span>
                                        </div>
                                    </div>
                                `).join('')}
                                ${confessions.length === 0 ? '<div style="text-align:center; color:#999;">No confessions yet. Be the first to whisper.</div>' : ''}
                            </div>
                            <hr style="margin:20px 0; border:0; border-top:1px solid #eee;">
                            <div class="form-group">
                                <label style="color: #333;">Whisper a Confession</label>
                                <textarea class="form-control" id="confessionInput" placeholder="Type anonymously..." rows="3" style="color: #333;"></textarea>
                                <button class="btn btn-primary btn-block" style="margin-top:10px; background: var(--primary); color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer;" onclick="submitConfession()">Whisper</button>
                            </div>
                        </div>
                    </div>
    `;

                document.body.appendChild(modal);
                modal.querySelector('.close-modal').onclick = () => modal.remove();

            } catch (e) {
                console.error(e);
                showNotification('Failed to load confessions', 'error');
            }
        };

        window.submitConfession = async function () {
            const input = document.getElementById('confessionInput');
            if (!input || !input.value.trim()) return;

            try {
                const user = JSON.parse(localStorage.getItem('sparkleUser') || '{}');
                await DashboardAPI.postConfession(input.value.trim(), user.campus || 'General');

                showNotification('Confession whispered...', 'success');
                input.value = '';

                const listContainer = document.getElementById('confessionsList');
                if (listContainer) {
                    listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#999;"><i class="fas fa-spinner fa-spin"></i> Refreshing...</div>';
                    const confessions = await DashboardAPI.loadConfessions();

                    listContainer.innerHTML = confessions.map(c => `
                        <div style="background:white; border:1px solid #ddd; padding:15px; border-radius:10px; margin-bottom:10px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                            <div style="font-size:15px; line-height:1.5; color: #333;">"${c.content || c.text}"</div>
                            <div style="display:flex; justify-content:space-between; margin-top:10px;font-size:12px;color:#999;">
                                <span><i class="fas fa-graduation-cap"></i> ${c.campus || 'Campus'}</span>
                                <span>${c.rating_count !== undefined ? c.rating_count : (c.reactions !== undefined ? c.reactions : 0)} <i class="fas fa-fire" style="color:orange;"></i></span>
                            </div>
                        </div>
    `).join('') || '<div style="text-align:center; color:#999;">No confessions yet. Be the first to whisper.</div>';
                }

            } catch (e) {
                console.error(e);
                showNotification('Failed to post confession', 'error');
            }
        };

        // ============ POLLS - FULL IMPLEMENTATION ============
        window.createPoll = () => {
            const modal = document.getElementById('createPollModal');
            if (modal) {
                modal.style.display = 'flex';
                document.getElementById('pollQuestion').value = '';
                const container = document.getElementById('pollOptionsContainer');
                if (container) {
                    container.innerHTML = `
                        <label class="form-label" style="color: #333;">Options</label>
                        <input type="text" class="form-control poll-option" style="margin-bottom: 5px; color: #333;" placeholder="Option 1">
                        <input type="text" class="form-control poll-option" style="margin-bottom: 5px; color: #333;" placeholder="Option 2">
                `;
                }
            } else {
                console.warn('createPollModal not found in DOM');
            }
        };

        window.addPollOption = () => {
            const container = document.getElementById('pollOptionsContainer') || document.getElementById('pollOptionsList');
            if (!container) return;

            if (container.querySelectorAll('input').length >= 6) {
                showNotification('Maximum 6 options allowed', 'warning');
                return;
            }

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'form-control poll-option';
            input.style.marginBottom = '5px';
            input.style.color = '#333';
            input.placeholder = `Option ${container.querySelectorAll('input').length + 1}`;
            container.appendChild(input);
        };

        window.submitPoll = async () => {
            const questionInput = document.getElementById('pollQuestion');
            const question = questionInput?.value;
            const optionInputs = document.querySelectorAll('.poll-option, .poll-option-val');
            const options = Array.from(optionInputs).map(i => i.value).filter(v => v && v.trim());

            console.log('📱 Sending Poll:', { question, optionsCount: options.length });

            if (!question || options.length < 2) {
                showNotification('Please fill in all fields (Question and at least 2 options)', 'warning');
                return;
            }

            try {
                const user = JSON.parse(localStorage.getItem('sparkleUser') || '{}');
                await DashboardAPI.createPoll({
                    question,
                    options,
                    campus: user.campus || 'General',
                    is_anonymous: document.getElementById('pollAnonymous')?.checked || false
                });

                showNotification('Poll created!', 'success');

                const modal = document.getElementById('createPollModal');
                if (modal) modal.style.display = 'none';
                const dynamicModals = document.querySelectorAll('.modal');
                dynamicModals.forEach(m => {
                    if (m.innerHTML.includes('Create Poll')) m.remove();
                });

                if (window.loadPolls) window.loadPolls();
            } catch (e) {
                console.error(e);
                showNotification('Failed to create poll', 'error');
            }
        };

        // ============ EVENTS - FULL IMPLEMENTATION ============
        window.viewEvents = async () => {
            try {
                const user = JSON.parse(localStorage.getItem('sparkleUser') || '{}');
                const userCampus = localStorage.getItem('sparkleUserCampus') || user.campus || 'all';

                let events = await DashboardAPI.loadEvents(userCampus);

                if (events.length === 0 && userCampus !== 'all') {
                    console.log('📱 No events for ' + userCampus + ', loading all...');
                    events = await DashboardAPI.loadEvents('all');
                }

                const modal = document.createElement('div');
                modal.className = 'modal';
                modal.style.display = 'flex';
                modal.innerHTML = `
                <div class="modal-content" style="max-width:600px; max-height:80vh; overflow-y:auto;">
                    <div class="modal-header">
                        <div class="modal-title" style="color: #333;"><i class="fas fa-calendar-alt"></i> Campus Events</div>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <button class="btn btn-primary btn-block" style="margin-bottom:20px; background: var(--primary); color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer;" onclick="createEvent()">
                            <i class="fas fa-plus"></i> Create Event
                        </button>
                        ${events.length === 0 ? '<p style="text-align:center; color:#999;">No upcoming events</p>' : events.map(e => `
                                <div style="background:#f8f9fa; padding:15px; border-radius:10px; margin-bottom:15px;">
                                    <h4 style="margin:0 0 10px 0; color: #333;">${e.title}</h4>
                                    <p style="margin:0 0 10px 0; color:#666; font-size:14px;">${e.description || ''}</p>
                                    <div style="display:flex; gap:15px; font-size:13px; color:#666; margin-bottom:10px;">
                                        <span><i class="fas fa-map-marker-alt"></i> ${e.location}</span>
                                        <span><i class="fas fa-clock"></i> ${new Date(e.start_time).toLocaleString()}</span>
                                    </div>
                                    <div style="display:flex; gap:10px;">
                                        <button class="btn btn-primary" style="font-size:12px; background: var(--primary); color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;" onclick="rsvpToEvent('${e.event_id}', 'going')">
                                            <i class="fas fa-check"></i> Going (${e.total_rsvps || 0})
                                        </button>
                                        <button class="btn" style="font-size:12px; background: #6c757d; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;" onclick="rsvpToEvent('${e.event_id}', 'maybe')">Maybe</button>
                                    </div>
                                </div>
                            `).join('')}
                    </div>
                </div>
                `;
                document.body.appendChild(modal);
                modal.querySelector('.close-modal').onclick = () => modal.remove();
            } catch (e) {
                console.error(e);
                showNotification('Failed to load events', 'error');
            }
        };

        window.createEvent = () => {
            const modal = document.getElementById('createEventModal');
            if (modal) {
                modal.style.display = 'flex';
                ['eventTitle', 'eventDescription', 'eventStartTime', 'eventLocation'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
            } else {
                console.warn('createEventModal not found');
            }
        };

        window.submitEvent = async () => {
            const title = document.getElementById('eventTitle')?.value;
            const description = document.getElementById('eventDescription')?.value;
            const location = document.getElementById('eventLocation')?.value;
            const start_time = document.getElementById('eventStartTime')?.value;

            if (!title || !description || !location || !start_time) {
                showNotification('Please fill in all fields', 'warning');
                return;
            }

            try {
                const user = JSON.parse(localStorage.getItem('sparkleUser') || '{}');
                await DashboardAPI.createEvent({
                    title,
                    description,
                    location,
                    campus: user.campus || 'General',
                    start_time,
                    is_public: true
                });

                showNotification('Event created!', 'success');

                const modal = document.getElementById('createEventModal');
                if (modal) modal.style.display = 'none';
                const dynamicModals = document.querySelectorAll('.modal');
                dynamicModals.forEach(m => {
                    if (m.innerHTML.includes('Create Campus Event') || m.innerHTML.includes('Create Event')) m.remove();
                });

                if (window.viewEvents) viewEvents();
            } catch (e) {
                console.error(e);
                showNotification('Failed to create event', 'error');
            }
        };

        window.rsvpToEvent = async (eventId, status) => {
            try {
                await DashboardAPI.rsvpEvent(eventId, status);
                showNotification('RSVP updated!', 'success');
                document.querySelectorAll('.modal').forEach(m => m.remove());
                viewEvents();
            } catch (e) {
                console.error(e);
                showNotification('Failed to RSVP', 'error');
            }
        };

        // ============ LIVE STREAMING - FULL IMPLEMENTATION ============
        window.startLiveStream = () => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.innerHTML = `
                <div class="modal-content" style="max-width:500px;">
                    <div class="modal-header">
                        <div class="modal-title" style="color: #333;"><i class="fas fa-video"></i> Start Live Stream</div>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label style="color: #333;">Stream Title</label>
                            <input type="text" class="form-control" id="streamTitle" placeholder="What are you streaming?" style="color: #333;">
                        </div>
                        <div class="form-group">
                            <label style="color: #333;">Description</label>
                            <textarea class="form-control" id="streamDescription" rows="2" style="color: #333;"></textarea>
                        </div>
                        <div class="form-group">
                            <label style="color: #333;">Category</label>
                            <select class="form-control" id="streamCategory" style="color: #333;">
                                <option>Gaming</option>
                                <option>Study</option>
                                <option>Music</option>
                                <option>Chat</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <button class="btn btn-primary btn-block" onclick="submitStream()" style="background: var(--primary); color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer;">Go Live</button>
                    </div>
                </div>
                `;
            document.body.appendChild(modal);
            modal.querySelector('.close-modal').onclick = () => modal.remove();
        };

        window.submitStream = async () => {
            const title = document.getElementById('streamTitle').value;
            const description = document.getElementById('streamDescription').value;
            const category = document.getElementById('streamCategory').value;

            if (!title) {
                showNotification('Please provide a stream title', 'warning');
                return;
            }

            try {
                const user = JSON.parse(localStorage.getItem('sparkleUser') || '{}');
                const result = await DashboardAPI.startStream({
                    title,
                    description,
                    category,
                    campus: user.campus || 'General',
                    stream_url: 'https://stream.sparkle.app/' + Date.now()
                });

                showNotification('Stream started!', 'success');
                document.querySelector('.modal').remove();
            } catch (e) {
                console.error(e);
                showNotification('Failed to start stream', 'error');
            }
        };

        // ============ SKILLS - FULL IMPLEMENTATION ============
        window.offerSkill = () => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.innerHTML = `
                <div class="modal-content" style="max-width:500px;">
                    <div class="modal-header">
                        <div class="modal-title" style="color: #333;"><i class="fas fa-graduation-cap"></i> Offer Your Skills</div>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label style="color: #333;">Skill Type</label>
                            <select class="form-control" id="skillType" style="color: #333;">
                                <option value="tutoring">Tutoring</option>
                                <option value="tech">Tech Help</option>
                                <option value="language">Language</option>
                                <option value="music">Music</option>
                                <option value="sports">Sports</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label style="color: #333;">Title</label>
                            <input type="text" class="form-control" id="skillTitle" placeholder="e.g., Math Tutoring, Guitar Lessons" style="color: #333;">
                        </div>
                        <div class="form-group">
                            <label style="color: #333;">Description</label>
                            <textarea class="form-control" id="skillDescription" rows="3" style="color: #333;"></textarea>
                        </div>
                        <div class="form-group">
                            <label style="color: #333;">Price</label>
                            <select class="form-control" id="skillPriceType" style="color: #333;">
                                <option value="free">Free</option>
                                <option value="paid">Paid</option>
                                <option value="negotiable">Negotiable</option>
                            </select>
                        </div>
                        <button class="btn btn-primary btn-block" onclick="submitSkillOffer()" style="background: var(--primary); color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer;">Offer Skill</button>
                    </div>
                </div>
                `;
            document.body.appendChild(modal);
            modal.querySelector('.close-modal').onclick = () => modal.remove();
        };

        window.submitSkillOffer = async () => {
            const skill_type = document.getElementById('skillType')?.value;
            const title = document.getElementById('skillTitle')?.value;
            const description = document.getElementById('skillDescription')?.value;
            const price_type = document.getElementById('skillPriceType')?.value;

            if (!skill_type || !title || !description || !price_type) {
                showNotification('Please fill in all fields', 'warning');
                return;
            }

            try {
                const user = JSON.parse(localStorage.getItem('sparkleUser') || '{}');
                await DashboardAPI.createSkillOffer({
                    skill_type,
                    title,
                    description,
                    price_type,
                    campus: user.campus || 'General',
                    subjects: [title]
                });

                showNotification('Skill offer created!', 'success');

                const dynamicModals = document.querySelectorAll('.modal');
                dynamicModals.forEach(m => {
                    if (m.innerHTML.includes('Offer Your Skills')) m.remove();
                });

                if (window.loadSkillMarketContent) window.loadSkillMarketContent();
            } catch (e) {
                console.error(e);
                showNotification('Failed to create offer', 'error');
            }
        };

        // ============ LOST & FOUND - FULL IMPLEMENTATION ============
        window.reportLostItem = () => {
            if (typeof showModal === 'function') {
                showModal('lostFound');
            } else {
                const modal = document.getElementById('lostFoundModal');
                if (modal) modal.style.display = 'flex';
            }

            const reportBtn = document.getElementById('reportItemBtn');
            if (reportBtn) {
                reportBtn.onclick = window.submitLostFoundItem;
            }
        };

        window.submitLostFoundItem = async () => {
            const type = document.getElementById('lfType')?.value || document.getElementById('itemType')?.value;
            const title = document.getElementById('lfItemName')?.value || document.getElementById('itemName')?.value;
            const description = document.getElementById('lfDescription')?.value || document.getElementById('itemDetails')?.value;
            const location = document.getElementById('lfLocation')?.value || 'See details';

            if (!type || !title || !description) {
                showNotification('Please fill in all fields', 'warning');
                return;
            }

            try {
                const user = JSON.parse(localStorage.getItem('sparkleUser') || localStorage.getItem('currentUser') || '{ }');
                await DashboardAPI.reportLostFoundItem({
                    type,
                    item_name: title,
                    description,
                    location_found: location,
                    date_occurred: new Date().toISOString().split('T')[0],
                    contact_email: user.email || 'Contact via message',
                    campus: user.campus || 'General'
                });

                showNotification('Item reported!', 'success');

                ['lfItemName', 'itemName', 'lfDescription', 'itemDetails', 'lfLocation'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });

                const modal = document.getElementById('lostFoundModal');
                if (modal) modal.style.display = 'none';

                if (window.loadLostFoundContent) window.loadLostFoundContent(type);
            } catch (e) {
                console.error('Failed to report item:', e);
                showNotification('Failed to report item: ' + e.message, 'error');
            }
        };

        // ============ SIDEBAR BADGE SYNCHRONIZATION ============
        window.updateSidebarBadges = async function () {
            console.log('📱 Updating sidebar badges...');
            try {
                const groups = await DashboardAPI.loadGroups();
                const groupsBadge = document.getElementById('groupsCountBadge');
                if (groupsBadge) groupsBadge.textContent = groups.length || '';

                const lostItems = await DashboardAPI.loadLostFoundItems('lost');
                const lostBadge = document.getElementById('lostItemsBadge');
                if (lostBadge) lostBadge.textContent = lostItems.length || '';

                const foundItems = await DashboardAPI.loadLostFoundItems('found');
                const foundBadge = document.getElementById('foundItemsBadge');
                if (foundBadge) foundBadge.textContent = foundItems.length || '';

                const skills = await DashboardAPI.loadSkillOffers('tutoring');
                const tutorsBadge = document.getElementById('tutorsBadge');
                if (tutorsBadge) tutorsBadge.textContent = skills.length || '';

                const events = await DashboardAPI.loadEvents();
                const eventsBadge = document.getElementById('eventsBadge');
                if (eventsBadge) eventsBadge.textContent = events.length || '';

                const messagesBadge = document.getElementById('messagesBadge');
                if (messagesBadge) messagesBadge.textContent = '3+';

            } catch (error) {
                console.error('Failed to update sidebar badges:', error);
            }
        };

        // ============ AUTO-RELOAD DATA ============
        console.log('📱 Dashboard is live! Initializing data...');
        await loadFeedPosts();
        await fetchAndRenderSuggestions(); // Load suggestions into sidebar or feed
        await loadAfterglowStories();
        await loadGroups();
        await loadConnectUsers();
        if (window.loadMoments) await loadMoments();
        if (window.loadMarketplace) await loadMarketplace();

        await updateSidebarBadges();

        setInterval(async () => {
            console.log('🔄 Silent Background Refresh...');
            if (document.querySelector('.modal[style*="display: flex"]') || document.querySelector('.afterglow-viewer-modal[style*="display: flex"]')) {
                console.log('⏸️ Refresh paused - Modal active');
                return;
            }

            await Promise.allSettled([
                loadFeedPosts({ silent: true }),
                loadAfterglowStories({ silent: true }),
                loadConnectUsers({ silent: true }),
                updateSidebarBadges()
            ]);
        }, 15000);

        console.log('📱 Dashboard is now fully dynamic!');

        document.getElementById('userSearchInput')?.addEventListener('input', debounce(async (e) => {
            console.log('📱 Searching users:', e.target.value);
            await loadConnectUsers(e.target.value);
        }, 500));

        document.getElementById('messageSearchInput')?.addEventListener('input', debounce(async (e) => {
            console.log('📱 Filtering messages:', e.target.value);
            await loadChatsFromAPI(e.target.value);
        }, 300));

        document.getElementById('postConfessionBtn')?.addEventListener('click', async () => {
            const text = document.getElementById('confessionText')?.value;
            if (!text) {
                showNotification('Please enter a confession', 'warning');
                return;
            }

            try {
                await DashboardAPI.postConfession(text);
                showNotification('Confession posted anonymously!', 'success');
                document.getElementById('confessionText').value = '';
                await loadEnhancedConfessions();
            } catch (error) {
                console.error('Failed to post confession:', error);
                showNotification('Failed to post confession', 'error');
            }
        });

        document.getElementById('createListingBtn')?.addEventListener('click', () => {
            showNotification('Marketplace listing creation is being integrated. Please use "Create Post" for now.', 'info');
        });

        document.getElementById('reportItemBtn')?.addEventListener('click', async () => {
            const type = document.getElementById('itemType')?.value;
            const title = document.getElementById('itemName')?.value;
            const description = document.getElementById('itemDetails')?.value;

            if (!title || !description) {
                showNotification('Please fill in all fields', 'warning');
                return;
            }

            try {
                await DashboardAPI.reportLostFoundItem({ type, title, description });
                showNotification('Item reported!', 'success');
                document.getElementById('itemName').value = '';
                document.getElementById('itemDetails').value = '';
                await loadLostFoundContent();
            } catch (error) {
                console.error('Failed to report item:', error);
                showNotification('Failed to report item', 'error');
            }
        });

        document.getElementById('offerSkillBtn')?.addEventListener('click', async () => {
            const title = document.getElementById('skillTitle')?.value;
            const description = document.getElementById('skillDescription')?.value;

            if (!title || !description) {
                showNotification('Please fill in all fields', 'warning');
                return;
            }

            try {
                await DashboardAPI.createSkillOffer({ title, description });
                showNotification('Skill offered!', 'success');
                document.getElementById('skillTitle').value = '';
                document.getElementById('skillDescription').value = '';
                await loadSkillMarketContent();
            } catch (error) {
                console.error('Failed to offer skill:', error);
                showNotification('Failed to offer skill', 'error');
            }
        });

        document.getElementById('createPollBtn')?.addEventListener('click', async () => {
            const question = document.getElementById('pollQuestion')?.value;
            const optionsInputs = document.querySelectorAll('#pollOptions input');
            const options = Array.from(optionsInputs).map(i => i.value).filter(v => v.trim() !== '');

            if (!question || options.length < 2) {
                showNotification('Please enter a question and at least 2 options', 'warning');
                return;
            }

            try {
                await DashboardAPI.createPoll(question, options);
                showNotification('Poll created!', 'success');
                document.getElementById('pollQuestion').value = '';
                await loadPolls();
            } catch (error) {
                console.error('Failed to create poll:', error);
                showNotification('Failed to create poll', 'error');
            }
        });

        // Interaction Helpers for New Post Cards
        window.quickComment = async (input, postId) => {
            const content = input.value.trim();
            if (!content) return;

            try {
                await DashboardAPI.postComment(postId, content);
                showNotification('Comment posted!', 'success');
                input.value = '';
                // Optional: refresh comments count in UI
                const card = input.closest('.post-card-wrapper');
                if (card) {
                    const countSpan = card.querySelector('.fa-comment').nextElementSibling;
                    if (countSpan) {
                        const current = parseInt(countSpan.textContent) || 0;
                        countSpan.textContent = `${current + 1} comments`;
                    }
                }
            } catch (e) {
                console.error(e);
                showNotification('Failed to post comment', 'error');
            }
        };

        window.showPostMenu = (postId, button) => {
            // Simplified menu for now
            const menu = document.createElement('div');
            menu.className = 'fixed bg-white shadow-2xl rounded-xl py-2 z-[1000] border border-gray-100 min-w-[160px] animate-in fade-in zoom-in duration-200';
            const rect = button.getBoundingClientRect();
            menu.style.top = `${rect.bottom + 8}px`;
            menu.style.right = `${window.innerWidth - rect.right}px`;

            menu.innerHTML = `
                <button class="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2" onclick="window.location.href='/post/${postId}'">
                    <i class="fas fa-external-link-alt text-gray-400"></i>
                    <span>View Post</span>
                </button>
                <button class="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2" onclick="shareManager.openShareSheet('post', '${postId}'); document.body.removeChild(this.parentElement)">
                    <i class="fas fa-share text-gray-400"></i>
                    <span>Share</span>
                </button>
                <button class="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center space-x-2" onclick="window.deletePostConfirm('${postId}', this); document.body.removeChild(this.parentElement)">
                    <i class="fas fa-trash-alt"></i>
                    <span>Delete</span>
                </button>
                `;

            document.body.appendChild(menu);

            const closeMenu = (e) => {
                if (!menu.contains(e.target) && e.target !== button) {
                    document.body.removeChild(menu);
                    document.removeEventListener('mousedown', closeMenu);
                }
            };
            document.addEventListener('mousedown', closeMenu);
        };

        const path = window.location.pathname;
        if (path.includes('/lost-found')) {
            console.log('📱 Direct load: Lost & Found');
            if (typeof window.loadLostFoundContent === 'function') window.loadLostFoundContent('all');
        } else if (path.includes('/marketplace')) {
            console.log('📱 Direct load: Marketplace');
            if (typeof window.loadMarketplace === 'function') window.loadMarketplace('all');
        } else if (path.includes('/skill-market')) {
            console.log('📱 Direct load: Skill Market');
            if (typeof window.loadSkillMarketContent === 'function') window.loadSkillMarketContent('all');
            else if (typeof window.loadSkillOffers === 'function') window.loadSkillOffers('all');
        } else if (path.includes('/groups')) {
            console.log('📱 Direct load: Groups');
            if (typeof window.loadGroups === 'function') window.loadGroups();
        } else if (path.includes('/moments')) {
            console.log('📱 Direct load: Moments');
            if (typeof window.loadMoments === 'function') window.loadMoments();
        } else if (path.includes('/messages')) {
            console.log('📱 Direct load: Messages');
            if (typeof window.loadChatsFromAPI === 'function') window.loadChatsFromAPI();
        } else if (path.includes('/connect')) {
            console.log('📱 Direct load: Connect');
            if (typeof window.loadConnectUsers === 'function') window.loadConnectUsers();
        } else if (path === '/dashboard' || path === '/' || path.includes('index')) {
            console.log('📱 Direct load: Dashboard');
            if (window.loadFeedPosts) window.loadFeedPosts();
            if (window.loadAfterglowStories) window.loadAfterglowStories();
        }

        // Poll for new notifications every 30 seconds
        setInterval(async () => {
            try {
                const notifications = await DashboardAPI.loadNotifications({ unreadOnly: true });
                // refresh only notification badges
                const unreadCount = notifications.filter(n => !n.is_read).length;
                ['notificationCount', 'notificationCountBottom'].forEach(id => {
                    const b = document.getElementById(id);
                    if (b) {
                        b.textContent = unreadCount;
                        b.style.display = unreadCount > 0 ? 'flex' : 'none';
                    }
                });
                if (notifications.length > 0) {
                    notifications.forEach(notification => {
                        const shownIds = JSON.parse(localStorage.getItem('shownNotifications') || '[]');
                        if (!shownIds.includes(notification.id)) {
                            const text = notification.content || notification.message || '';
                            // NEW PREMIUM TOAST CALL
                            showNotification(text, {
                                type: notification.type || 'info',
                                title: notification.actor_name || notification.user || 'New Notification',
                                avatar: notification.actor_avatar || '/uploads/avatars/default.png',
                                url: notification.action_url || '#'
                            });

                            shownIds.push(notification.id);
                            if (shownIds.length > 50) shownIds.shift();
                            localStorage.setItem('shownNotifications', JSON.stringify(shownIds));
                        }
                    });
                }
            } catch (e) {
                console.error('Failed to poll notifications:', e);
            }
        }, 30000);

        // Real-time listener for instant notifications via Firebase
        if (window.sparkleRealtime && typeof window.sparkleRealtime.watchNotifications === 'function') {
            window.sparkleRealtime.watchNotifications((notifications) => {
                if (!notifications || !notifications.length) return;

                const unreadCount = notifications.filter(n => !n.read && !n.is_read).length;
                ['notificationCount', 'notificationCountBottom'].forEach(id => {
                    const b = document.getElementById(id);
                    if (b) {
                        b.textContent = unreadCount;
                        b.style.display = unreadCount > 0 ? 'flex' : 'none';
                    }
                });

                // Only show toasts for recent notifications (last 2 mins)
                const now = Date.now();
                notifications.forEach(notification => {
                    if (notification.read || notification.is_read) return;

                    const timestamp = notification.timestamp?.seconds ? notification.timestamp.seconds * 1000 :
                        (notification.created_at ? new Date(notification.created_at).getTime() : now);

                    if (now - timestamp < 120000) { // last 2 minutes
                        const shownIds = JSON.parse(localStorage.getItem('shownNotifications') || '[]');
                        if (!shownIds.includes(notification.id)) {
                            const text = notification.content || notification.message || notification.body || '';

                            showNotification(text, {
                                type: notification.type || 'info',
                                title: notification.actor_name || notification.user || notification.title || 'New Notification',
                                avatar: notification.actor_avatar || '/uploads/avatars/default.png',
                                url: notification.action_url || notification.url || '#'
                            });

                            shownIds.push(notification.id);
                            if (shownIds.length > 50) shownIds.shift();
                            localStorage.setItem('shownNotifications', JSON.stringify(shownIds));
                        }
                    }
                });
            });
        }

    }, 100);
});

// ============================================================
// ============ SPARKLE NOTIFICATION SYSTEM ===================
// ============================================================
(function initSparkleNotifications() {
    // ---- Styles ----
    const styleEl = document.createElement('style');
    styleEl.id = 'sparkle-notif-styles';
    styleEl.textContent = `
        /* === Notification Panel === */
        #sparkle-notif-overlay {
            position: fixed; inset: 0; z-index: 99990;
            background: transparent; display: none;
        }
        #sparkle-notif-overlay.open { display: block; }

        #sparkle-notif-panel {
            position: fixed;
            top: 60px; right: 10px;
            width: 380px; max-width: calc(100vw - 20px);
            max-height: 85vh;
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 8px 40px rgba(233,30,99,0.18), 0 2px 12px rgba(0,0,0,0.12);
            z-index: 99999;
            display: flex; flex-direction: column;
            overflow: hidden;
            transform: translateY(-10px) scale(0.97);
            opacity: 0;
            transition: transform 0.25s cubic-bezier(.4,0,.2,1), opacity 0.25s ease;
            pointer-events: none;
        }
        #sparkle-notif-panel.open {
            transform: translateY(0) scale(1);
            opacity: 1;
            pointer-events: all;
        }
        .sn-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 16px 18px 12px;
            border-bottom: 1px solid #fce4ec;
            background: linear-gradient(135deg, #fff 60%, #fce4ec);
        }
        .sn-header h3 {
            font-size: 18px; font-weight: 700; color: #1e1e2e; margin: 0;
        }
        .sn-header-actions { display: flex; align-items: center; gap: 10px; }
        .sn-mark-all {
            font-size: 12px; font-weight: 600; color: #e91e63;
            background: none; border: none; cursor: pointer; padding: 4px 8px;
            border-radius: 8px; transition: background 0.2s;
        }
        .sn-mark-all:hover { background: #fce4ec; }
        .sn-close-btn {
            width: 28px; height: 28px; border-radius: 50%;
            background: #f5f5f5; border: none; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-size: 16px; color: #666; transition: background 0.2s;
        }
        .sn-close-btn:hover { background: #fce4ec; color: #e91e63; }
        .sn-list {
            flex: 1; overflow-y: auto; padding: 6px 0;
            scrollbar-width: thin; scrollbar-color: #fce4ec transparent;
        }
        .sn-list::-webkit-scrollbar { width: 4px; }
        .sn-list::-webkit-scrollbar-thumb { background: #f48fb1; border-radius: 4px; }
        .sn-item {
            display: flex; align-items: flex-start; gap: 12px;
            padding: 12px 16px; cursor: pointer;
            transition: background 0.2s;
            border-left: 3px solid transparent;
            position: relative;
        }
        .sn-item:hover { background: #fff5f8; }
        .sn-item.sn-unread {
            background: #fff0f5;
            border-left-color: #e91e63;
        }
        .sn-avatar-wrap {
            position: relative; flex-shrink: 0;
            width: 46px; height: 46px;
        }
        .sn-avatar {
            width: 46px; height: 46px; border-radius: 50%; object-fit: cover;
            border: 2px solid #fce4ec;
        }
        .sn-type-badge {
            position: absolute; bottom: -2px; right: -2px;
            width: 20px; height: 20px; border-radius: 50%;
            background: #e91e63;
            display: flex; align-items: center; justify-content: center;
            font-size: 9px; color: white;
            border: 2px solid white;
            box-shadow: 0 1px 4px rgba(233,30,99,0.4);
        }
        .sn-body { flex: 1; min-width: 0; }
        .sn-text { font-size: 13px; color: #333; line-height: 1.45; }
        .sn-text strong { color: #1e1e2e; }
        .sn-time { font-size: 11px; color: #e91e63; margin-top: 3px; font-weight: 600; }
        .sn-dot {
            width: 8px; height: 8px; border-radius: 50%;
            background: #e91e63; flex-shrink: 0; margin-top: 6px;
        }
        .sn-empty {
            text-align: center; padding: 40px 20px; color: #aaa;
        }
        .sn-empty i { font-size: 40px; color: #f48fb1; margin-bottom: 10px; display: block; }
        .sn-footer {
            padding: 10px 16px;
            border-top: 1px solid #fce4ec;
            text-align: center;
        }
        .sn-footer a {
            font-size: 13px; color: #e91e63; font-weight: 600;
            text-decoration: none;
        }

        /* === Toast Notifications === */
        #sparkle-toast-container {
            position: fixed; bottom: 20px; right: 20px;
            display: flex; flex-direction: column; gap: 10px;
            z-index: 999999; pointer-events: none;
            max-width: calc(100vw - 40px);
        }
        .sn-toast {
            display: flex; align-items: center; gap: 12px;
            background: #fff; border-radius: 14px;
            padding: 12px 16px;
            box-shadow: 0 4px 24px rgba(233,30,99,0.18), 0 1px 6px rgba(0,0,0,0.1);
            border-left: 4px solid #e91e63;
            min-width: 280px; max-width: 360px;
            pointer-events: all;
            transform: translateX(110%);
            opacity: 0;
            transition: transform 0.35s cubic-bezier(.4,0,.2,1), opacity 0.35s ease;
            cursor: pointer;
        }
        .sn-toast.visible {
            transform: translateX(0);
            opacity: 1;
        }
        .sn-toast.hiding {
            transform: translateX(110%);
            opacity: 0;
        }
        .sn-toast-avatar-wrap {
            position: relative; flex-shrink: 0;
            width: 40px; height: 40px;
        }
        .sn-toast-avatar {
            width: 40px; height: 40px; border-radius: 50%; object-fit: cover;
            border: 2px solid #fce4ec;
        }
        .sn-toast-badge {
            position: absolute; bottom: -2px; right: -2px;
            width: 16px; height: 16px; border-radius: 50%;
            background: #e91e63; color: white;
            display: flex; align-items: center; justify-content: center;
            font-size: 7px; border: 2px solid white;
        }
        .sn-toast-body { flex: 1; min-width: 0; }
        .sn-toast-title { font-size: 13px; font-weight: 700; color: #1e1e2e; }
        .sn-toast-text { font-size: 12px; color: #666; margin-top: 2px; }
        .sn-toast-close {
            background: none; border: none; color: #ccc; font-size: 16px;
            cursor: pointer; padding: 0 2px; line-height: 1;
            transition: color 0.2s; flex-shrink: 0;
        }
        .sn-toast-close:hover { color: #e91e63; }
        .sn-sparkle-logo {
            font-size: 9px; color: #e91e63; font-weight: 700;
            text-transform: uppercase; letter-spacing: 0.5px;
            margin-top: 4px;
        }

        /* === Bell animation when notification arrives === */
        @keyframes bellRing {
            0%,100% { transform: rotate(0); }
            10% { transform: rotate(15deg); }
            20% { transform: rotate(-15deg); }
            30% { transform: rotate(12deg); }
            40% { transform: rotate(-10deg); }
            50% { transform: rotate(8deg); }
            60% { transform: rotate(0); }
        }
        #navBellIcon.ringing { animation: bellRing 0.7s ease; color: #e91e63; }

        /* === Mobile Responsive === */
        @media (max-width: 480px) {
            #sparkle-notif-panel {
                top: 0; right: 0; left: 0;
                width: 100vw; max-width: 100vw;
                height: 100vh; max-height: 100vh;
                border-radius: 0;
            }
            #sparkle-toast-container {
                bottom: 10px; right: 10px; left: 10px;
            }
            .sn-toast { min-width: unset; max-width: 100%; }
        }
    `;
    document.head.appendChild(styleEl);

    // ---- Type config (icon + colour per notification type) ----
    const TYPE_CONFIG = {
        follow: { icon: 'fa-user-plus', bg: '#e91e63', label: 'followed you' },
        spark: { icon: 'fa-fire', bg: '#ff5722', label: 'sparked your post' },
        like: { icon: 'fa-heart', bg: '#e91e63', label: 'liked your post' },
        comment: { icon: 'fa-comment', bg: '#9c27b0', label: 'commented on your post' },
        reply: { icon: 'fa-reply', bg: '#673ab7', label: 'replied to your comment' },
        share: { icon: 'fa-share-alt', bg: '#2196f3', label: 'shared your post' },
        story_like: { icon: 'fa-bolt', bg: '#e91e63', label: 'liked your story' },
        story_share: { icon: 'fa-share-alt', bg: '#00bcd4', label: 'shared your story' },
        message: { icon: 'fa-envelope', bg: '#4caf50', label: 'sent you a message' },
        default: { icon: 'fa-bell', bg: '#e91e63', label: '' },
    };

    function getTypeConf(type) {
        return TYPE_CONFIG[type] || TYPE_CONFIG.default;
    }

    function timeAgo(dateStr) {
        const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }

    // ---- Build Panel DOM ----
    function buildPanel() {
        if (document.getElementById('sparkle-notif-panel')) return;

        const overlay = document.createElement('div');
        overlay.id = 'sparkle-notif-overlay';
        overlay.addEventListener('click', closePanel);
        document.body.appendChild(overlay);

        const panel = document.createElement('div');
        panel.id = 'sparkle-notif-panel';
        panel.innerHTML = `
            <div class="sn-header">
                <h3>🔔 Notifications</h3>
                <div class="sn-header-actions">
                    <button class="sn-mark-all" id="sn-mark-all-btn">Mark all read</button>
                    <button class="sn-close-btn" id="sn-close-btn">&times;</button>
                </div>
            </div>
            <div class="sn-list" id="sn-list">
                <div class="sn-empty"><i class="fas fa-bell-slash"></i><div>No notifications yet</div></div>
            </div>
            <div class="sn-footer">
                <a href="#" onclick="window.closeNotificationPanel()">Close</a>
            </div>
        `;
        document.body.appendChild(panel);

        panel.querySelector('#sn-close-btn').addEventListener('click', closePanel);
        panel.querySelector('#sn-mark-all-btn').addEventListener('click', markAllRead);
        // Prevent clicks inside panel from closing it via overlay
        panel.addEventListener('click', e => e.stopPropagation());
    }

    // ---- Build Toast container ----
    function buildToastContainer() {
        if (document.getElementById('sparkle-toast-container')) return;
        const el = document.createElement('div');
        el.id = 'sparkle-toast-container';
        document.body.appendChild(el);
    }

    // ---- Open / Close Panel ----
    window.toggleNotificationPanel = function () {
        const panel = document.getElementById('sparkle-notif-panel');
        if (!panel) { buildPanel(); setTimeout(openPanel, 50); return; }
        panel.classList.contains('open') ? closePanel() : openPanel();
    };

    window.closeNotificationPanel = closePanel;

    function openPanel() {
        const panel = document.getElementById('sparkle-notif-panel');
        const overlay = document.getElementById('sparkle-notif-overlay');
        if (!panel) return;
        overlay?.classList.add('open');
        panel.classList.add('open');
        fetchAndRenderNotifications();
    }

    function closePanel() {
        document.getElementById('sparkle-notif-panel')?.classList.remove('open');
        document.getElementById('sparkle-notif-overlay')?.classList.remove('open');
    }

    // ---- Render notification item ----
    function renderItem(n) {
        const conf = getTypeConf(n.type);
        const avatar = n.actor_avatar || n.avatar_url || '/uploads/avatars/default.png';
        const actorName = n.actor_name || n.actor_username || 'Someone';
        const content = n.content || conf.label || 'sent you a notification';
        const time = timeAgo(n.created_at || new Date().toISOString());
        const isUnread = !n.is_read && !n.read;

        const el = document.createElement('div');
        el.className = `sn-item${isUnread ? ' sn-unread' : ''}`;
        el.dataset.id = n.notification_id || n.id;
        el.innerHTML = `
            <div class="sn-avatar-wrap">
                <img class="sn-avatar" src="${avatar}" onerror="this.src='/uploads/avatars/default.png'">
                <div class="sn-type-badge" style="background:${conf.bg}">
                    <i class="fas ${conf.icon}"></i>
                </div>
            </div>
            <div class="sn-body">
                <div class="sn-text"><strong>${actorName}</strong> ${content}</div>
                <div class="sn-time">${time}</div>
            </div>
            ${isUnread ? '<div class="sn-dot"></div>' : ''}
        `;

        el.addEventListener('click', () => {
            markRead(n.notification_id || n.id);
            el.classList.remove('sn-unread');
            el.querySelector('.sn-dot')?.remove();
            if (n.action_url) window.location.href = n.action_url;
        });

        return el;
    }

    // ---- Fetch & render panel list ----
    async function fetchAndRenderNotifications() {
        const list = document.getElementById('sn-list');
        if (!list) return;

        list.innerHTML = '<div class="sn-empty"><i class="fas fa-spinner fa-spin"></i><div>Loading…</div></div>';

        try {
            const notifications = await DashboardAPI.loadNotifications();
            renderList(notifications);
            updateBadge(notifications.filter(n => !n.is_read && !n.read).length);
        } catch (e) {
            list.innerHTML = '<div class="sn-empty"><i class="fas fa-exclamation-circle"></i><div>Failed to load</div></div>';
        }
    }

    function renderList(notifications) {
        const list = document.getElementById('sn-list');
        if (!list) return;
        list.innerHTML = '';
        if (!notifications || notifications.length === 0) {
            list.innerHTML = '<div class="sn-empty"><i class="fas fa-bell-slash"></i><div>You\'re all caught up!</div></div>';
            return;
        }
        notifications.forEach(n => list.appendChild(renderItem(n)));
    }

    // ---- Badge update ----
    function updateBadge(count) {
        ['notificationCount', 'notificationCountBottom'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = count > 99 ? '99+' : count;
            el.style.display = count > 0 ? 'flex' : 'none';
        });
    }

    // ---- Mark read ----
    async function markRead(id) {
        try { await DashboardAPI.markNotificationRead(id); } catch (_) { }
    }

    async function markAllRead() {
        try {
            await DashboardAPI.markAllNotificationsRead();
            document.querySelectorAll('.sn-item.sn-unread').forEach(el => {
                el.classList.remove('sn-unread');
                el.querySelector('.sn-dot')?.remove();
            });
            updateBadge(0);
        } catch (e) { }
    }

    // ---- Toast ----
    function showNotifToast(notification) {
        buildToastContainer();
        const container = document.getElementById('sparkle-toast-container');
        if (!container) return;

        const conf = getTypeConf(notification.type);
        const avatar = notification.actor_avatar || notification.avatar_url || '/uploads/avatars/default.png';
        const actorName = notification.actor_name || notification.actor_username || 'Someone';
        const content = notification.content || conf.label || 'sent you a notification';

        const toast = document.createElement('div');
        toast.className = 'sn-toast';
        toast.innerHTML = `
            <div class="sn-toast-avatar-wrap">
                <img class="sn-toast-avatar" src="${avatar}" onerror="this.src='/uploads/avatars/default.png'">
                <div class="sn-toast-badge" style="background:${conf.bg}"><i class="fas ${conf.icon}"></i></div>
            </div>
            <div class="sn-toast-body">
                <div class="sn-toast-title">${actorName}</div>
                <div class="sn-toast-text">${content}</div>
                <div class="sn-sparkle-logo">✦ Sparkle</div>
            </div>
            <button class="sn-toast-close">&times;</button>
        `;

        container.appendChild(toast);

        // Slide in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => toast.classList.add('visible'));
        });

        const dismiss = () => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 400);
        };

        toast.addEventListener('click', () => {
            dismiss();
            if (notification.action_url) window.location.href = notification.action_url;
        });
        toast.querySelector('.sn-toast-close').addEventListener('click', (e) => {
            e.stopPropagation(); dismiss();
        });

        // Auto-dismiss after 5 seconds
        setTimeout(dismiss, 5000);

        // Ring the bell
        const bell = document.getElementById('navBellIcon');
        if (bell) {
            bell.classList.remove('ringing');
            void bell.offsetWidth; // reflow
            bell.classList.add('ringing');
            setTimeout(() => bell.classList.remove('ringing'), 800);
        }
    }

    window.showNotificationToast = showNotifToast;

    // ---- Socket listener ----
    function setupSocketListener() {
        // Try to find the app socket (various possible names)
        const sock = window.socket || window.appSocket || window.io?.();
        if (sock && sock.on) {
            sock.on('new-notification', (notification) => {
                showNotifToast(notification);
                updateBadge((parseInt(document.getElementById('notificationCount')?.textContent) || 0) + 1);
                // If panel is open, prepend the new item
                const list = document.getElementById('sn-list');
                if (list && document.getElementById('sparkle-notif-panel')?.classList.contains('open')) {
                    const emptyEl = list.querySelector('.sn-empty');
                    if (emptyEl) list.innerHTML = '';
                    list.insertBefore(renderItem(notification), list.firstChild);
                }
            });
            return true;
        }
        return false;
    }

    // ---- Polling fallback (every 30s if socket not available) ----
    let _lastUnreadCount = 0;
    let _pollingStarted = false;

    function startPolling() {
        if (_pollingStarted) return;
        _pollingStarted = true;
        setInterval(async () => {
            try {
                const data = await DashboardAPI.loadNotifications({ unreadOnly: true });
                const count = data.length;
                updateBadge(count);
                // Show toast for brand-new ones (last 90 seconds)
                const now = Date.now();
                const shownIds = JSON.parse(localStorage.getItem('sparkle_shown_notifs') || '[]');
                data.forEach(n => {
                    const ts = n.created_at ? new Date(n.created_at).getTime() : 0;
                    if (now - ts < 90000 && !shownIds.includes(n.id || n.notification_id)) {
                        showNotifToast(n);
                        shownIds.push(n.id || n.notification_id);
                    }
                });
                if (shownIds.length > 100) shownIds.splice(0, shownIds.length - 100);
                localStorage.setItem('sparkle_shown_notifs', JSON.stringify(shownIds));
            } catch (_) { }
        }, 30000);
    }

    // ---- Init ----
    function init() {
        buildPanel();
        buildToastContainer();

        // Try socket first; fall back to polling
        const socketConnected = setupSocketListener();
        if (!socketConnected) {
            // Retry socket for up to 10s (it might not be connected yet)
            let attempts = 0;
            const retry = setInterval(() => {
                attempts++;
                if (setupSocketListener() || attempts > 10) {
                    clearInterval(retry);
                    if (attempts > 10) startPolling();
                }
            }, 1000);
        }

        // Load unread count on startup
        DashboardAPI.loadNotifications({ unreadOnly: true }).then(data => {
            updateBadge(data.length);
        }).catch(() => { });

        // Start polling as a safety net regardless (it won't double-toast, 
        // because shown IDs are tracked in localStorage)
        setTimeout(startPolling, 10000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 200);
    }
})();
