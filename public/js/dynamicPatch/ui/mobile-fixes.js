/**
 * SPARKLE MOBILE FIXES - PRODUCTION-GRADE STATE MANAGER
 * Master Spec: keyboard detection, nav toggle, scroll isolation, state management
 *
 * PATCH v3: Fully removed all nav toggle behaviors.
 */

export function initMobileFixes() {

    /* ── STATE ─────────────────────────────────────────────── */
    const state = {
        keyboardOpen:    false,
        isNearBottom:    true,
        initialHeight:   window.innerHeight,
    };

    /* ── ELEMENT REFS ──────────────────────────────────────── */
    const msgContainer   = () => document.getElementById('messagesContainer');

    /* ══════════════════════════════════════════════════════════
       1. KEYBOARD DETECTION
       Uses viewport height drop as keyboard signal
    ══════════════════════════════════════════════════════════ */
    const KEYBOARD_THRESHOLD = 120;

    window.addEventListener('resize', () => {
        const currentHeight = window.innerHeight;
        const wasOpen = state.keyboardOpen;
        state.keyboardOpen = currentHeight < (state.initialHeight - KEYBOARD_THRESHOLD);

        if (state.keyboardOpen !== wasOpen) {
            applyKeyboardState();
        }
    }, { passive: true });

    function applyKeyboardState() {
        if (state.keyboardOpen) {
            document.body.classList.add('keyboard-open');
        } else {
            document.body.classList.remove('keyboard-open');
        }
    }

    /* ══════════════════════════════════════════════════════════
       2. NEAR-BOTTOM TRACKING (smart auto-scroll)
    ══════════════════════════════════════════════════════════ */
    const mc = msgContainer();
    if (mc) {
        mc.addEventListener('scroll', () => {
            const threshold = 120;
            state.isNearBottom = (mc.scrollHeight - mc.scrollTop - mc.clientHeight) < threshold;
        }, { passive: true });
    }

    // Expose for messaging JS
    window.sparkleLayoutState = state;
    window.isNearBottom = () => state.isNearBottom;

    /* ══════════════════════════════════════════════════════════
       3. PREVENT BODY DRAG / ELASTIC SCROLL on iOS
    ══════════════════════════════════════════════════════════ */
    document.body.addEventListener('touchmove', (e) => {
        // Allow scroll only within the messages container
        if (!e.target.closest('#messagesContainer')) {
            e.preventDefault();
        }
    }, { passive: false });

    /* ══════════════════════════════════════════════════════════
       4. INITIAL STATE SETUP
    ══════════════════════════════════════════════════════════ */
    applyKeyboardState();
}

/* ── AUTO-INIT ─────────────────────────────────────────────────── */
if (typeof document !== 'undefined') {
    const init = () => {
        if (!window.mobileFixesInit) {
            initMobileFixes();
            window.mobileFixesInit = true;
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
