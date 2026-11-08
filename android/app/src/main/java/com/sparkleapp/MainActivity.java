package com.sparkleapp;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;
import com.sparkleapp.plugins.MediaStoreSaver;
import com.sparkleapp.plugins.PrivacyProtectionPlugin;
import com.sparkleapp.plugins.SparkleInsetsPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PrivacyProtectionPlugin.class);
        registerPlugin(SparkleInsetsPlugin.class);
        registerPlugin(MediaStoreSaver.class);
        super.onCreate(savedInstanceState);
    // Apply edge-to-edge natively before the WebView paints so the theme
    // background reaches the physical top edge from the very first frame
    // (the JS StatusBar.setOverlaysWebView call only lands after mount).
    enableEdgeToEdge();
    // Force SOFT_INPUT_ADJUST_NOTHING, overriding whatever the merged manifest
    // resolved to. The source manifest declares adjustNothing, but the built
    // APK was shipping adjustResize (verified in all three merged/packaged
    // manifests), so the declaration was being overridden at merge time.
    forceKeyboardMode();
}

/**
 * The chat keyboard squeeze is implemented by SparkleInsetsPlugin, which pads
 * the WebView by the IME height so the CSS layout viewport shrinks from the
 * bottom: the message list compresses, the header stays put, and the composer
 * rides just above the keys.
 *
 * That only works if the Android window itself does NOT also react to the
 * keyboard. With adjustResize the system resizes the window *and* the plugin
 * pads the WebView, which is a double adjustment — the observed symptom was
 * the whole page being pushed up out of the screen when the keyboard opened.
 *
 * So the mode is set here, in code, rather than trusted to the manifest: this
 * runs after the manifest merge and cannot be overridden by a library theme.
 */
private void forceKeyboardMode() {
    try {
        getWindow().setSoftInputMode(
            android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING);
    } catch (Exception e) {
        // Never let a window-flag failure take the app down.
        android.util.Log.w("SparkleMain", "Could not set SOFT_INPUT_ADJUST_NOTHING", e);
    }
}

    private void enableEdgeToEdge() {
        try {
            Window window = getWindow();
            WindowCompat.setDecorFitsSystemWindows(window, false);
            window.setStatusBarColor(Color.TRANSPARENT);
            // Translucent nav bar keeps 3-button-nav glyphs legible while still
            // letting the app theme paint behind it; gesture nav stays invisible.
            window.setNavigationBarColor(Color.TRANSPARENT);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Status bar contrast is managed by the JS StatusBar plugin
                // (icon style follows the active screen theme). Navigation bar
                // keeps system contrast enforcement so 3-button glyphs stay
                // legible over light content.
                window.setStatusBarContrastEnforced(false);
            }
        } catch (Exception ignored) {
            // Never block app startup on a OEM window quirk; the JS-side
            // StatusBarController overlay remains as a fallback.
        }
    }
}
