/**
 * SPARKLE MOBILE FIXES - PRODUCTION-GRADE STATE MANAGER
 * Master Spec: keyboard detection, nav toggle, scroll isolation, state management
 *
 * PATCH v2: Navigation scoping
 *   - toggleSparkleNav() is the GLOBAL bottom-nav expander.
 *   - On the messages page we do NOT use it. Instead messages.ejs calls
 *     toggleChatNav() which controls ONLY the in-chat nav copy.
 *   - Outside messages, toggleSparkleNav() works exactly as before.
 */

export function initMobileFixes() {

    /* ── STATE ─────────────────────────────────────────────── */
    const state = {
        keyboardOpen:    false,
        navExpanded:     false,
        chatNavExpanded: false,          // chat-local nav state
        isNearBottom:    true,
        activeWallpaper: null,
        initialHeight:   window.innerHeight,
    };

    /* ── HELPERS ────────────────────────────────────────────── */
    const isMessagesPage = () => document.body.classList.contains('messages-page') ||
                                  !!document.getElementById('messagesContainer');

    /* ── ELEMENT REFS ──────────────────────────────────────── */
    const bottomNav      = () => document.querySelector('.bottom-nav');
    const composer       = () => document.querySelector('.chat-composer');
    const msgContainer   = () => document.getElementById('messagesContainer');

    /* ══════════════════════════════════════════════════════════
       1. KEYBOARD DETECTION
       Uses viewport height drop > 120px as keyboard signal
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

    /* ══════════════════════════════════════════════════════════
       2. GLOBAL NAVIGATION TOGGLE
       Works on ALL pages EXCEPT the messages/chat page.
       On the messages page the in-chat nav has its own toggle.
    ══════════════════════════════════════════════════════════ */
    window.toggleSparkleNav = function() {
        // On the messages page: do nothing — the chat page manages its own nav
        if (isMessagesPage()) return;

        if (state.keyboardOpen) return;
        state.navExpanded = !state.navExpanded;
        const nav = bottomNav();
        if (nav) {
            nav.setAttribute('data-expanded', state.navExpanded ? 'true' : 'false');
        }
        renderGlobalNavState();
    };

    function renderGlobalNavState() {
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

    /* ══════════════════════════════════════════════════════════
       3. CHAT-LOCAL NAVIGATION TOGGLE
       Called ONLY from the messages page chat-nav icon.
       Controls the in-chat bottom nav without touching global state.
    ══════════════════════════════════════════════════════════ */
    window.toggleChatNav = function() {
        if (state.keyboardOpen) return;
        state.chatNavExpanded = !state.chatNavExpanded;

        // Target the shared bottom-nav but only while we are on the messages page
        const nav = bottomNav();
        if (nav) {
            nav.setAttribute('data-expanded', state.chatNavExpanded ? 'true' : 'false');
        }
        renderChatNavState();
    };

    function renderChatNavState() {
        const nav = bottomNav();
        if (!nav) return;
        const extras = nav.querySelectorAll('.b-nav-item:not(.chat-menu-btn)');
        extras.forEach(el => {
            if (state.chatNavExpanded) {
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

    /* ══════════════════════════════════════════════════════════
       4. NEAR-BOTTOM TRACKING (smart auto-scroll)
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
       5. PREVENT BODY DRAG / ELASTIC SCROLL on iOS
    ══════════════════════════════════════════════════════════ */
    document.body.addEventListener('touchmove', (e) => {
        // Allow scroll only within the messages container
        if (!e.target.closest('#messagesContainer')) {
            e.preventDefault();
        }
    }, { passive: false });

    /* ══════════════════════════════════════════════════════════
       6. INITIAL STATE SETUP
    ══════════════════════════════════════════════════════════ */
    applyKeyboardState();
    // On messages page start with chat nav collapsed; on other pages use global state
    if (isMessagesPage()) {
        renderChatNavState();
    } else {
        renderGlobalNavState();
    }
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
