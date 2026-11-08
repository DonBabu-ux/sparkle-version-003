package com.sparkleapp.plugins;

import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Reports the real system-bar / display-cutout safe-area insets (in CSS pixels,
 * i.e. density-independent dp) to the web layer so layout padding is exact on
 * every device instead of relying on env() support inside Android WebView.
 *
 * Emits an `insetsChanged` event whenever the insets change (rotation,
 * fold, keyboard-driven system bar changes) so the CSS variables stay live.
 */
@CapacitorPlugin(name = "SparkleInsets")
public class SparkleInsetsPlugin extends Plugin {

    private static final int INSET_TYPES =
            WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();

    /**
     * windowSoftInputMode is "adjustNothing" so the Android window does NOT
     * pan or resize when the IME appears.  This plugin instead pads the WebView
     * bottom by the IME height so the CSS layout viewport shrinks from the
     * bottom only — the flex chat layout compresses the message list while the
     * header remains completely stationary.  On Android 11+ edge-to-edge
     * "adjustResize" is a no-op anyway; "adjustNothing" makes it explicit and
     * ensures the same behaviour on Android 10 and below (where "adjustResize"
     * used to pan/resize the entire window, shifting the header upward).
     */

    private String lastSentJson = "";

    @Override
    public void load() {
        super.load();
        final View webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;

        webView.post(() -> {
            ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
                JSObject data = toJs(windowInsets);
                String json = data.toString();
                if (!json.equals(lastSentJson)) {
                    lastSentJson = json;
                    notifyListeners("insetsChanged", data);
                }

                // IME squeeze (WhatsApp-style keyboard).
                //
                // MainActivity enables edge-to-edge, i.e. decorFitsSystemWindows(false).
                // On Android 11+ that makes the app responsible for window insets and
                // "adjustResize" becomes a no-op: the system no longer shrinks our
                // window for the keyboard. The observed behavior was the whole window
                // panning up (top cut off) and the composer ending up under the keys.
                //
                // The height is reported to JS as `imeHeight` and JS applies it as a
                // CSS variable, so the layout adapts to whatever the keyboard really
                // is rather than to a constant.
                //
                // The WebView is deliberately NOT padded any more. setPadding does not
                // reliably shrink the CSS layout viewport — on some devices it clips
                // the content instead, which is exactly the "keyboard covers the input
                // box" symptom — and combined with a CSS height it shrinks twice.
                // Both mechanisms were live at once, so only this one is kept.
                Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
                // Kept only so the value is read for logging if needed; the layout
                // is driven entirely by the `imeHeight` CSS variable on the JS side.
                int imePx = ime.bottom > 0 ? ime.bottom : 0;
                if (imePx > 0 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    android.util.Log.d("SparkleInsets", "IME visible: " + imePx + "px (reported to JS)");
                }

                // No setPadding here — see the note above.
                return windowInsets;
            });
            ViewCompat.requestApplyInsets(webView);
        });
    }

    @PluginMethod
    public void getSafeAreaInsets(PluginCall call) {
        final View webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) {
            call.reject("WebView not available");
            return;
        }
        webView.post(() -> {
            WindowInsetsCompat rootInsets = ViewCompat.getRootWindowInsets(webView);
            if (rootInsets == null) {
                call.reject("Window insets unavailable");
                return;
            }
            call.resolve(toJs(rootInsets));
        });
    }

    private JSObject toJs(WindowInsetsCompat windowInsets) {
        JSObject ret = new JSObject();
        float density = getBridge().getWebView().getResources().getDisplayMetrics().density;
        Insets insets = windowInsets.getInsets(INSET_TYPES);
        ret.put("top", dp(insets.top, density));
        ret.put("bottom", dp(insets.bottom, density));
        ret.put("left", dp(insets.left, density));
        ret.put("right", dp(insets.right, density));
        ret.put("topPx", insets.top);
        ret.put("bottomPx", insets.bottom);
        ret.put("leftPx", insets.left);
        ret.put("rightPx", insets.right);

        // The keyboard's real height, in CSS pixels, straight from the IME
        // inset. This is what makes the layout adaptive rather than hardcoded:
        // the OS reports whatever the active keyboard is actually occupying, so
        // Gboard, SwiftKey, a landscape split keyboard, a tablet, and a hardware
        // keyboard all produce a different value and all lay out correctly.
        //
        // Padding the WebView was the previous approach and it is not reliable:
        // on some devices WebView padding clips content instead of shrinking the
        // CSS layout viewport, which left the composer under the keys. The JS
        // layer only needs the number.
        Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
        double imeHeight = ime.bottom > 0 ? dp(ime.bottom, density) : 0;
        ret.put("imeHeight", imeHeight);
        ret.put("imeVisible", ime.bottom > 0);
        return ret;
    }

    private static double dp(int px, float density) {
        if (density <= 0f) return 0;
        return Math.round((px / density) * 100.0) / 100.0;
    }
}
