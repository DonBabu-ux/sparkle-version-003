/**
 * WhatsApp-style Mobile Viewport Fix
 * Handles the keyboard/bottom-nav/chat-input stacking correctly.
 */

export function initMobileFixes() {
    let initialHeight = window.innerHeight;

    function handleMobileLayout() {
        const chatComposer = document.getElementById('chatComposer');
        const bottomNav = document.querySelector('.bottom-nav');
        
        // Detect Keyboard using innerHeight comparison
        const handleResize = () => {
            const currentHeight = window.innerHeight;
            
            // If height drops significantly, keyboard is likely open
            if (currentHeight < initialHeight - 100) {
                document.body.classList.add('keyboard-open');
            } else {
                document.body.classList.remove('keyboard-open');
            }
        };

        // Fine-tune positioning using VisualViewport (if supported)
        const handleViewport = () => {
            if (!window.visualViewport) return;

            const viewportHeight = window.visualViewport.height;
            const fullHeight = window.innerHeight;
            const keyboardHeight = fullHeight - viewportHeight;

            if (keyboardHeight > 100) {
                document.body.classList.add('keyboard-open');
                
                // Position input bar directly above the visible viewport (keyboard)
                if (chatComposer) {
                    // In true WhatsApp style, the visual viewport offset is what matters
                    // When the keyboard is open, the input sits at the bottom of the visible area
                    chatComposer.style.bottom = `${keyboardHeight}px`;
                }

                if (window.sparkChat) {
                    window.sparkChat.scrollToBottom(true);
                }
            } else {
                document.body.classList.remove('keyboard-open');
                if (chatComposer) {
                    // Reset to sit above navigation
                    chatComposer.style.bottom = '60px';
                }
            }
        };

        window.addEventListener('resize', handleResize);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleViewport);
        }
        
        handleResize();
        if (window.visualViewport) handleViewport();
    }

    handleMobileLayout();

    // Stable Height Handling (Real VH)
    function setRealVH() {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    window.addEventListener('resize', setRealVH);
    setRealVH();

    // Visibility fallback (Close keyboard state on app hide)
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            document.body.classList.remove("keyboard-open");
        }
    });
}

// Auto-init
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
