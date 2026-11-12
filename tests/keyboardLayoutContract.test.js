// tests/keyboardLayoutContract.test.js
//
// Guards the native half of "the composer always sits above the keyboard".
//
// This class of bug is invisible in code review because every individual piece
// looks correct: the config says resize:'none', the JS subtracts --ime-height,
// the manifest says adjustNothing. What actually shipped was a double
// adjustment, because @capacitor/keyboard's Android implementation reads ONLY
// the resizeOnFullScreen flag (KeyboardPlugin.java:20 — setResizeMode and
// getResizeMode are both unimplemented, and the resize mode is never consulted).
// With it true, Keyboard.java's onStart calls possiblyResizeChildOfContent(),
// which sets frameLayoutParams.height on the WebView's own container on every
// keyboard show — resizing the WebView natively on top of the JS subtracting
// --ime-height. resize:'none' looks like it prevents that and does nothing at
// all on Android.
//
// So the invariant is: exactly ONE mechanism adjusts the layout, and it is the
// JS one. These tests fail if a second one is re-enabled.
//
// Nothing here is device verification — no emulator ran. It is a contract test
// over the files the APK is built from.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));

// Both the source config and the copy cap sync writes into the APK's assets.
// Editing only one of them is exactly how the built app diverges from the repo.
const CONFIG_SOURCES = [
    'capacitor.config.json',
    'android/app/src/main/assets/capacitor.config.json',
];

describe('Keyboard: exactly one mechanism resizes the layout, and it is the JS one', () => {
    it('resizeOnFullScreen is false in every config the APK can read', () => {
        for (const src of CONFIG_SOURCES) {
            const cfg = readJson(src);
            const keyboard = cfg.plugins && cfg.plugins.Keyboard;
            assert.ok(keyboard, src + ' declares a Keyboard plugin block');
            assert.equal(
                keyboard.resizeOnFullScreen,
                false,
                src + ' must not let @capacitor/keyboard resize the WebView container. ' +
                'Keyboard.java onStart() calls possiblyResizeChildOfContent() when this is true, ' +
                'which sets frameLayoutParams.height on the WebView itself — resizing it natively ' +
                'on top of --ime-height shrinking KeyboardSafeContainer.'
            );
        }
    });

    it('resize is none, so no body/viewport shrink is configured either', () => {
        for (const src of CONFIG_SOURCES) {
            assert.equal(readJson(src).plugins.Keyboard.resize, 'none', src);
        }
    });

    it('every config source agrees on the Keyboard block', () => {
        const canonical = readJson(CONFIG_SOURCES[0]).plugins.Keyboard;
        for (const src of CONFIG_SOURCES.slice(1)) {
            assert.deepEqual(
                readJson(src).plugins.Keyboard,
                canonical,
                src + ' disagrees with the source config — the APK ships the assets copy, ' +
                'so a config edit that misses it has no effect on the built app.'
            );
        }
    });
});

describe('Keyboard: the JS mechanism is actually wired, not assumed', () => {
    it('main.tsx boots the publisher that writes --ime-height', () => {
        const main = read('frontend/src/main.tsx');
        assert.match(main, /initKeyboardHeight\(\)/, 'initKeyboardHeight() is called at boot');
        assert.match(main, /initSafeAreaInsets\(\)/, 'initSafeAreaInsets() is called at boot');
    });

    it('the publisher subscribes to the real measured events, not a constant', () => {
        const svc = read('frontend/src/services/keyboardHeight.ts');
        assert.match(svc, /addListener\(\s*['"]keyboardWillShow['"]/, 'subscribes to keyboardWillShow');
        assert.match(svc, /addListener\(\s*['"]keyboardWillHide['"]/, 'subscribes to keyboardWillHide');
        assert.match(svc, /info\?*\.keyboardHeight/, 'uses the height the OS measured');
    });

    it('KeyboardSafeContainer subtracts the variable it is published into', () => {
        // If the container stopped consuming --ime-height, the publisher would
        // write into the void and the composer would sit under the keys with
        // nothing visibly wrong.
        const layout = read('frontend/src/components/SafeLayout.tsx');
        assert.match(layout, /calc\(100% - var\(--ime-height/, 'height is subtracted from the viewport');
        assert.match(layout, /maxHeight:\s*'calc\(100% - var\(--ime-height/, 'maxHeight is subtracted too');
        assert.match(layout, /getKeyboardHeight\(\)/, 'defers to the native publisher when it is live');
    });

    it('@capacitor/keyboard is a declared dependency of the frontend that imports it', () => {
        // It resolved only by walking up to the repo-root node_modules, so a
        // frontend-only install produced a build that could not resolve it.
        const pkg = readJson('frontend/package.json');
        const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
        assert.ok(deps['@capacitor/keyboard'], 'frontend/package.json declares @capacitor/keyboard');
    });
});

describe('Keyboard: the native window does not react twice', () => {
    it('MainActivity forces SOFT_INPUT_ADJUST_NOTHING in code, not just the manifest', () => {
        // The merged and packaged manifests all resolved to adjustResize, so the
        // source declaration was being overridden at merge time. Only the
        // in-code call is authoritative.
        const manifest = read('android/app/src/main/AndroidManifest.xml');
        assert.match(manifest, /android:windowSoftInputMode="adjustNothing"/, 'manifest declares adjustNothing');

        const activity = read('android/app/src/main/java/com/sparkleapp/MainActivity.java');
        assert.match(
            activity,
            /setSoftInputMode\(\s*[\s\S]{0,80}SOFT_INPUT_ADJUST_NOTHING\s*\)/,
            'MainActivity sets the mode at runtime, after the manifest merge'
        );
    });

    it('SparkleInsetsPlugin reports the height but does not pad or resize the WebView', () => {
        const plugin = read('android/app/src/main/java/com/sparkleapp/plugins/SparkleInsetsPlugin.java');
        // Padding was the previous mechanism and it is not reliable: setPadding
        // clips content on some devices instead of shrinking the CSS layout
        // viewport, which is the "keyboard covers the input box" symptom.
        assert.doesNotMatch(plugin, /\.setPadding\(/, 'no WebView padding — JS owns the layout');
        assert.doesNotMatch(plugin, /frameLayoutParams/, 'no native resize of the WebView container');
        assert.match(plugin, /imeHeight/, 'still reports the measured height to JS');
        assert.match(plugin, /import android\.os\.Build;/, 'Build import present — this was the missing import that blocked every APK build');
    });

    it('the stale "plugin pads the WebView" comment is gone', () => {
        // Two comments claimed the removed padding mechanism and described a
        // system that no longer existed, which is how the double-shrink stayed
        // invisible for so long.
        const activity = read('android/app/src/main/java/com/sparkleapp/MainActivity.java');
        assert.doesNotMatch(activity, /pads\s+the\s+WebView/i, 'MainActivity no longer claims the plugin pads');
        const plugin = read('android/app/src/main/java/com/sparkleapp/plugins/SparkleInsetsPlugin.java');
        assert.doesNotMatch(plugin, /instead pads the WebView/i, 'SparkleInsets class doc no longer claims padding');
    });
});
