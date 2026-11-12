// APK keyboard diagnostic — run in the device WebView console
// (chrome://inspect -> inspect -> Console), then open the keyboard and paste again.
//
// This exists because the evidence so far points somewhere different from where
// the code assumes: index.css:43-46 defines --safe-area-inset-top from env(),
// which Android WebView supports natively. So the top inset that now works was
// never proof the native insets plugin works, and there is no env() equivalent
// for the keyboard. --ime-height comes only from the plugin.

(async () => {
  const cap = window.Capacitor;
  const cs = getComputedStyle(document.documentElement);
  const root = document.documentElement;

  const line = (k, v) => console.log('  ' + k.padEnd(34) + String(v));

  console.log('--- current state (keyboard CLOSED unless you just opened it) ---');
  line('Capacitor present:', !!cap);
  line('isNativePlatform:', cap && cap.isNativePlatform ? cap.isNativePlatform() : 'n/a');
  line('platform:', cap && cap.getPlatform ? cap.getPlatform() : 'n/a');

  line('--ime-height (computed):', cs.getPropertyValue('--ime-height').trim() || '(NOT SET)');
  line('--ime-height (inline):', root.style.getPropertyValue('--ime-height') || '(NOT SET)');
  line('--safe-area-inset-top:', cs.getPropertyValue('--safe-area-inset-top').trim() || '(NOT SET)');
  line('env(safe-area-inset-top):',
    CSS.supports('top: env(safe-area-inset-top)') ? 'supported' : 'unsupported');

  line('window.innerHeight:', window.innerHeight);
  line('visualViewport.height:', window.visualViewport ? window.visualViewport.height : 'n/a');
  line('windowSoftInputMode source:', '(native)');

  console.log('');
  console.log('--- the plugin itself ---');
  try {
    const p = cap.Plugins && cap.Plugins.SparkleInsets;
    line('plugin registered:', !!p);
    if (p) {
      const ins = await p.getSafeAreaInsets();
      console.log('  getSafeAreaInsets() ->', JSON.stringify(ins));
      const has = p.addListener && typeof p.addListener === 'function';
      line('addListener available:', has);
      if (has) {
        const h = await p.addListener('insetsChanged', (i) => {
          console.log('  insetsChanged -> ' + JSON.stringify(i));
        });
        line('subscribed:', !!h);
        console.log('  now OPEN THE KEYBOARD, then watch for insetsChanged lines above');
      }
    }
  } catch (e) {
    line('plugin call FAILED:', e && e.message);
  }

  console.log('');
  console.log('--- what the layout actually does ---');
  const kbdOpen = root.classList.contains('sparkle-keyboard-open');
  line('sparkle-keyboard-open:', kbdOpen);
  const cont = document.querySelector('[data-chat-mode]');
  if (cont) {
    const r = cont.getBoundingClientRect();
    line('chat container height:', Math.round(r.height));
    line('chat container bottom:', Math.round(r.bottom));
    line('viewport height:', window.innerHeight);
    line('container overflows viewport:', r.bottom > window.innerHeight + 1 ? 'YES - composer is cut off' : 'no');
  } else {
    line('[data-chat-mode] element:', 'not found (are you on the chat screen?)');
  }
})();
