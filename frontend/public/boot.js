/*
 * public/boot.js — runs before first paint (referenced from index.html <head>).
 *
 * Three jobs, all inline-script free (the CSP is script-src 'self' + tiktok):
 *   1. Apply the stored theme before the boot splash paints.
 *   2. Load webfonts AFTER the first paint so they never delay it.
 *   3. Retire the static boot splash once React mounts its tree.
 */
(function () {
  'use strict';

  var html = document.documentElement;

  // ── 1. Stored theme before first paint (mirrors main.tsx) ──────────────────
  try {
    var raw = localStorage.getItem('user-storage');
    if (raw) {
      var parsed = JSON.parse(raw);
      var theme = parsed && parsed.state && parsed.state.theme;
      if (theme === 'dark') { html.classList.add('dark'); html.style.colorScheme = 'dark'; }
      else if (theme === 'light') { html.classList.remove('dark'); html.style.colorScheme = 'light'; }
      if (theme === 'dark' || theme === 'light') html.setAttribute('data-theme', theme);
    }
  } catch (e) { /* storage blocked or unparseable — the app settles the theme later */ }

  // The splash stays hidden (see index.html) until the stored theme has been
  // applied, so the first visible frame never paints the wrong theme. This is
  // the reveal: it runs in the same blocking script execution, before the
  // first paint. The fallbacks only guard against a throw above.
  function reveal() { html.setAttribute('data-theme-ready', ''); }
  reveal();
  window.addEventListener('load', reveal);
  window.setTimeout(reveal, 3000);

  // ── 2. Fonts after first paint ─────────────────────────────────────────────
  var FONTS_HREF =
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900' +
    '&family=Inter:wght@300;400;500;600;700;800;900' +
    '&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,800' +
    '&family=DM+Sans:wght@400;500;700&display=swap';

  function loadFonts() {
    if (document.getElementById('boot-fonts-link')) return;
    if (document.querySelector('link[rel="stylesheet"][href*="fonts.googleapis.com/css2"]')) return;
    var link = document.createElement('link');
    link.id = 'boot-fonts-link';
    link.rel = 'stylesheet';
    link.href = FONTS_HREF;
    document.head.appendChild(link);
  }
  if (window.requestAnimationFrame) window.requestAnimationFrame(loadFonts);
  else window.setTimeout(loadFonts, 0);

  // ── 3. Retire the static splash once React mounts ──────────────────────────
  function retireStaticSplash() {
    var boot = document.getElementById('boot-splash');
    var root = document.getElementById('root');
    if (!boot || !root) return;

    var done = false;
    var observer = null;

    function kill() {
      if (done) return;
      done = true;
      if (observer) { observer.disconnect(); observer = null; }
      if (boot.parentNode) boot.parentNode.removeChild(boot);
    }

    // React's createRoot().render() normally clears #root itself; this covers
    // the case where it appends instead, so the static splash can never be
    // revealed after the React splash unmounts.
    if (window.MutationObserver) {
      observer = new MutationObserver(function () {
        if (root.childElementCount > 1 || !root.contains(boot)) kill();
      });
      observer.observe(root, { childList: true });
    }
    window.setTimeout(kill, 4000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', retireStaticSplash);
  } else {
    retireStaticSplash();
  }
})();