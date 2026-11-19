package com.sparkleapp.plugins;

import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.crashlytics.FirebaseCrashlytics;

/**
 * Crash reporting bridge for a WebView shell ("SparkleDiagnostics").
 *
 * A Capacitor app's crashes are mostly *web* crashes: a thrown promise in the
 * SPA, a failed socket reconnect loop, a renderer kill after OOM. Native
 * Crashlytics alone sees none of them, so this plugin gives the JS layer a way
 * to push its own failures into the same dashboard:
 *
 *   SparkleDiagnostics.recordNonFatal({ message, stack })
 *   SparkleDiagnostics.log({ message })
 *   SparkleDiagnostics.setUserId({ id })
 *   SparkleDiagnostics.testNativeCrash()   ← one-shot verification
 *
 * Native crashes (FGs start rejection, ConnectionService bind failure, OEM
 * Telecom quirks) are captured automatically by the firebase-crashlytics SDK
 * declared in app/build.gradle — no code needed for those.
 */
@CapacitorPlugin(name = "SparkleDiagnostics")
public class SparkleDiagnosticsPlugin extends Plugin {

    /** Crashlytics log lines are capped far below a full minified JS stack. */
    private static final int STACK_LOG_LIMIT = 16_384;

    @PluginMethod
    public void recordNonFatal(PluginCall call) {
        String message = call.getString("message", "js error");
        String stack = call.getString("stack");
        try {
            FirebaseCrashlytics crashlytics = FirebaseCrashlytics.getInstance();
            // Keys/tags keep the stack out of the grouping message while still
            // making it searchable: a group is "one SPA failure mode", not one
            // stack trace.
            crashlytics.setCustomKey("js_message", abbreviate(message, 1024));
            if (stack != null && !stack.isEmpty()) {
                crashlytics.log(abbreviate(stack, STACK_LOG_LIMIT));
            }
            crashlytics.recordException(new SparkleJsException(abbreviate(message, 256)));
            call.resolve();
        } catch (Exception e) {
            call.reject("recordNonFatal failed: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void log(PluginCall call) {
        try {
            FirebaseCrashlytics crashlytics = FirebaseCrashlytics.getInstance();
            crashlytics.log(abbreviate(call.getString("message", ""), STACK_LOG_LIMIT));
            call.resolve();
        } catch (Exception e) {
            call.reject("log failed: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void setUserId(PluginCall call) {
        String id = call.getString("id", "");
        try {
            FirebaseCrashlytics.getInstance().setUserId(abbreviate(id, 1024));
            call.resolve();
        } catch (Exception e) {
            call.reject("setUserId failed: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("firebase", true);
        call.resolve(ret);
    }

    /**
     * Forces a native crash so the Crashlytics wiring can be verified on a
     * real device (check the Firebase console ~1 min later). JS-triggerable so
     * it never needs a debug build — guard the call site in the app's own
     * debug menu.
     */
    @PluginMethod
    public void testNativeCrash(PluginCall call) {
        call.resolve();
        throw new RuntimeException("Sparkle diagnostics test crash (expected)");
    }

    /** Enable/disable collection at runtime, e.g. for a GDPR opt-out toggle. */
    @PluginMethod
    public void setCollectionEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        try {
            FirebaseCrashlytics.getInstance().setCrashlyticsCollectionEnabled(enabled);
            call.resolve();
        } catch (Exception e) {
            call.reject("setCollectionEnabled failed: " + e.getMessage(), e);
        }
    }

    private static String abbreviate(String value, int limit) {
        if (value == null) return "";
        if (value.length() <= limit) return value;
        return value.substring(0, limit) + "…[truncated]";
    }
}