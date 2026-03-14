// mobile-fixes.js

export function initMobileFixes() {
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
}
