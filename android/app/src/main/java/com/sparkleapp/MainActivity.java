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
