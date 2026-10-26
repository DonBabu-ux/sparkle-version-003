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
                // Padding the WebView by the IME height shrinks the CSS layout viewport
                // instead: the flex chat layout compresses, the input dock stays pinned
                // just above the keyboard, and window.visualViewport (used by
                // ChatInputDock to drop the safe-area pad) reports the shrink. When the
                // keyboard closes the IME inset is 0, so nothing changes.
                Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
                int targetBottom = ime.bottom > 0 ? ime.bottom : 0;
                if (view.getPaddingBottom() != targetBottom) {
                    view.setPadding(view.getPaddingLeft(), view.getPaddingTop(), view.getPaddingRight(), targetBottom);
                }

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
        return ret;
    }

    private static double dp(int px, float density) {
        if (density <= 0f) return 0;
        return Math.round((px / density) * 100.0) / 100.0;
    }
}
