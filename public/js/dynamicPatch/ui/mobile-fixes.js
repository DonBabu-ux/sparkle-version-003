/**
 * SPARKLE MOBILE FIXES - PRODUCTION-GRADE STATE MANAGER
 * Master Spec: keyboard detection, nav toggle, scroll isolation, state management
 */

export function initMobileFixes() {

    /* ── STATE ─────────────────────────────────────────────────── */
    const state = {
        keyboardOpen:    false,
        navExpanded:     false,
        isNearBottom:    true,
        activeWallpaper: null,
        initialHeight:   window.innerHeight,
    };

    /* ── ELEMENT REFS ──────────────────────────────────────────── */
    const bottomNav      = () => document.querySelector('.bottom-nav');
    const composer       = () => document.querySelector('.chat-composer');
    const msgContainer   = () => document.getElementById('messagesContainer');

    /* ══════════════════════════════════════════════════════════════
       1. KEYBOARD DETECTION
       Uses viewport height drop > 120px as keyboard signal
    ══════════════════════════════════════════════════════════════ */
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
        const nav = bottomNav();

        if (state.keyboardOpen) {
            // KEYBOARD OPEN
            document.body.classList.add('keyboard-open');
            if (nav) {
                nav.style.transform = 'translateY(100%)';
                nav.style.opacity   = '0';
                nav.style.pointerEvents = 'none';
            }
            // Collapse nav state so it reopens cleanly
            state.navExpanded = false;
        } else {
            // KEYBOARD CLOSED
            document.body.classList.remove('keyboard-open');
            if (nav) {
                nav.style.transform = '';
                nav.style.opacity   = '';
                nav.style.pointerEvents = '';
            }
        }
    }

    /* ══════════════════════════════════════════════════════════════
       2. NAVIGATION TOGGLE (Home icon collapses/expands nav)
       Only works when keyboard is closed
    ══════════════════════════════════════════════════════════════ */
    window.toggleSparkleNav = function() {
        if (state.keyboardOpen) return; // never expand while typing
        state.navExpanded = !state.navExpanded;
        const nav = bottomNav();
        if (nav) {
            nav.setAttribute('data-expanded', state.navExpanded ? 'true' : 'false');
        }
        renderNavState();
    };

    function renderNavState() {
        const nav = bottomNav();
        if (!nav) return;
        const extras = nav.querySelectorAll('.b-nav-item:not(.home-btn)');
        extras.forEach(el => {
            if (state.navExpanded) {
                el.style.opacity   = '1';
                el.style.transform = 'translateY(0)';
                el.style.pointerEvents = '';
            } else {
                el.style.opacity   = '0';
                el.style.transform = 'translateY(8px)';
                el.style.pointerEvents = 'none';
            }
        });
    }

    /* ══════════════════════════════════════════════════════════════
       3. NEAR-BOTTOM TRACKING (smart auto-scroll)
    ══════════════════════════════════════════════════════════════ */
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

    /* ══════════════════════════════════════════════════════════════
       4. PREVENT BODY DRAG / ELASTIC SCROLL on iOS
    ══════════════════════════════════════════════════════════════ */
    document.body.addEventListener('touchmove', (e) => {
        // Allow scroll only within the messages container
        if (!e.target.closest('#messagesContainer')) {
            e.preventDefault();
        }
    }, { passive: false });

    /* ══════════════════════════════════════════════════════════════
       5. INITIAL STATE SETUP
    ══════════════════════════════════════════════════════════════ */
    applyKeyboardState();
    renderNavState();
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
