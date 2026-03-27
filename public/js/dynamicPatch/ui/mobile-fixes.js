/**
 * WhatsApp-style Mobile Viewport Fix
 * Handles the keyboard/bottom-nav/chat-input stacking correctly.
 */

export function initMobileFixes() {
    let initialHeight = window.innerHeight;

    window.addEventListener("resize", () => {
        const currentHeight = window.innerHeight;
        const bottomNav = document.querySelector(".bottom-nav");
        const chatInput = document.querySelector(".chat-composer");

        if (currentHeight < initialHeight - 120) {
            // Keyboard is OPEN
            document.body.classList.add("keyboard-open");
            if (bottomNav) bottomNav.style.display = "none";
        } else {
            // Keyboard is CLOSED
            document.body.classList.remove("keyboard-open");
            if (bottomNav) bottomNav.style.display = "block";
        }
    });
}

// Auto-init for non-module loaders fallback
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
