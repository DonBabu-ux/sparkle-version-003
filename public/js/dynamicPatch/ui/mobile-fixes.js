/**
 * Mobile Viewport Fix
 * Handles the keyboard/bottom-nav/chat-input conflict using visualViewport API.
 */

export function initMobileFixes() {
    function handleMobileLayout() {
        const chatComposer = document.getElementById('chatComposer');
        const bottomNav = document.querySelector('.bottom-nav');
        
        // Only run on mobile-sized screens
        if (window.innerWidth > 1024) {
            // Reset styles if resized back to desktop
            if (chatComposer) chatComposer.style.bottom = '0';
            if (bottomNav) bottomNav.style.transform = 'translateY(0)';
            return;
        }

        const handleViewport = () => {
            if (!window.visualViewport) return;

            const viewportHeight = window.visualViewport.height;
            const fullHeight = window.innerHeight;
            const keyboardHeight = fullHeight - viewportHeight;

            // If keyboard is open (typically > 100px)
            if (keyboardHeight > 100) {
                // Move chat input above keyboard
                if (chatComposer) {
                    chatComposer.style.bottom = `${keyboardHeight + 5}px`;
                    chatComposer.style.zIndex = '1000';
                }
                
                // Hide bottom navigation
                if (bottomNav) {
                    bottomNav.style.transform = 'translateY(100%)';
                }

                // Scroll to bottom when keyboard opens
                if (window.sparkChat) {
                    window.sparkChat.scrollToBottom(true);
                }
            } else {
                // Keyboard closed
                if (chatComposer) {
                    // Sit above the navigation bar
                    chatComposer.style.bottom = '60px';
                }
                if (bottomNav) {
                    bottomNav.style.transform = 'translateY(0)';
                }
            }
        };

        window.visualViewport.addEventListener('resize', handleViewport);
        window.visualViewport.addEventListener('scroll', handleViewport); 
        
        handleViewport();
    }

    handleMobileLayout();

    // Stable Height Handling (Real VH)
    function setRealVH() {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    window.addEventListener('resize', setRealVH);
    setRealVH();
}

// Auto-init if not imported as module (e.g. via <script src="...">)
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
             if (!window.mobileFixesInit) {
                 initMobileFixes();
                 window.mobileFixesInit = true;
             }
        });
    } else {
        if (!window.mobileFixesInit) {
            initMobileFixes();
            window.mobileFixesInit = true;
        }
    }
}
