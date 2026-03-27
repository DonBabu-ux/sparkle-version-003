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

        if (currentHeight < initialHeight - 100) {
            // Keyboard is OPEN
            if (bottomNav) bottomNav.classList.add("hidden");
            
            // Force input to stick to keyboard
            if (chatInput) chatInput.style.bottom = "0px";
        } else {
            // Keyboard is CLOSED
            if (bottomNav) bottomNav.classList.remove("hidden");
            if (chatInput) chatInput.style.bottom = "0px";
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
