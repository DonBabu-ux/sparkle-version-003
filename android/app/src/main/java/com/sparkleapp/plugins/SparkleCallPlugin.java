package com.sparkleapp.plugins;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * JS-facing surface of the Sparkle call stack ("SparkleCall").
 *
 * The signal plane (WebRTC, socket.io) stays entirely in the web layer. This
 * plugin is what makes an ongoing Sparkle call visible to the OS:
 *
 *  registerPhoneAccount()     - register the self-managed Telecom account
 *  startCall()                - outgoing call: placeCall + foreground service
 *  reportIncomingCall()      - ring: full-screen notification + addNewIncomingCall
 *  answer() / decline()       - resolve a ringing call
 *  setCallConnected()        - peer answered → ACTIVE
 *  endCall()                 - local hang-up
 *  setMuted() / getState()    - mirror JS mute state into the OS snapshot
 *
 * Every state change also emits the "callEvent" event, and the notification
 * action buttons and Android Auto/Wear answer/reject surfaces funnel through
 * the same CallCoordinator paths, so JS needs one subscription to see all of
 * them. Events fired while the bridge is cold are still recoverable via
 * getState().
 */
@CapacitorPlugin(name = "SparkleCall")
public class SparkleCallPlugin extends Plugin {

    @Override
    public void load() {
        super.load();
        CallCoordinator.attach(this);
        Context context = getContext();
        if (context != null) {
            CallCoordinator.ensureChannels(context);
            CallCoordinator.ensureRegistered(context);
        }
    }

    @Override
    protected void handleOnDestroy() {
        CallCoordinator.detach(this);
        super.handleOnDestroy();
    }

    @PluginMethod
    public void registerPhoneAccount(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context unavailable");
            return;
        }
        CallCoordinator.ensureChannels(context);
        CallCoordinator.ensureRegistered(context);
        JSObject ret = new JSObject();
        ret.put("selfManagedSupported", Build.VERSION.SDK_INT >= Build.VERSION_CODES.O);
        call.resolve(ret);
    }

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("selfManaged", Build.VERSION.SDK_INT >= Build.VERSION_CODES.O);
        ret.put("fullScreenIntent", permissionGranted(Manifest.permission.USE_FULL_SCREEN_INTENT));
        ret.put("audio", permissionGranted(Manifest.permission.RECORD_AUDIO));
        ret.put("camera", permissionGranted(Manifest.permission.CAMERA));
        ret.put("notifications", notificationsAllowed());
        call.resolve(ret);
    }

    @PluginMethod
    public void getState(PluginCall call) {
        call.resolve(CallCoordinator.getSnapshot());
    }

    @PluginMethod
    public void startCall(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context unavailable");
            return;
        }
        String peer = call.getString("peer", "");
        String displayName = call.getString("displayName", "");
        boolean video = call.getBoolean("video", false);
        if (!permissionGranted(Manifest.permission.RECORD_AUDIO)) {
            // A microphone FGS (Android 14+) cannot start ungranted, and calls
            // need the mic anyway — fail loudly instead of crashing in
            // startForeground(SecurityException).
            call.reject("RECORD_AUDIO permission not granted");
            return;
        }
        if (video && !permissionGranted(Manifest.permission.CAMERA)) {
            call.reject("CAMERA permission not granted");
            return;
        }
        try {
            CallCoordinator.startOutgoingCall(context, peer, displayName, video);
            call.resolve();
        } catch (Exception e) {
            call.reject("startCall failed: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void reportIncomingCall(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context unavailable");
            return;
        }
        if (!permissionGranted(Manifest.permission.RECORD_AUDIO)) {
            call.reject("RECORD_AUDIO permission not granted");
            return;
        }
        if (!notificationsAllowed()) {
            // Android 13+ hides the full-screen intent and denies
            // POST_NOTIFICATIONS-gated notifications; the JS layer should call
            // LocalNotifications.requestPermissions() and retry.
            call.reject("POST_NOTIFICATIONS permission not granted");
            return;
        }
        String peer = call.getString("peer", "");
        String displayName = call.getString("displayName", "");
        boolean video = call.getBoolean("video", false);
        try {
            CallCoordinator.reportIncomingCall(context, peer, displayName, video);
            call.resolve();
        } catch (Exception e) {
            call.reject("reportIncomingCall failed: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void answer(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context unavailable");
            return;
        }
        CallCoordinator.answer(context);
        call.resolve();
    }

    @PluginMethod
    public void decline(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context unavailable");
            return;
        }
        CallCoordinator.decline(context);
        call.resolve();
    }

    @PluginMethod
    public void setCallConnected(PluginCall call) {
        CallCoordinator.setConnected();
        call.resolve();
    }

    @PluginMethod
    public void endCall(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context unavailable");
            return;
        }
        CallCoordinator.hangUpLocal(context);
        call.resolve();
    }

    @PluginMethod
    public void setMuted(PluginCall call) {
        CallCoordinator.setMuted(call.getBoolean("muted", false));
        call.resolve();
    }

    /** How long a ring may stay unanswered before it auto-declines as missed. */
    @PluginMethod
    public void setRingTimeout(PluginCall call) {
        CallCoordinator.setRingTimeoutMs(call.getInt("ms", CallCoordinator.DEFAULT_RING_TIMEOUT_MS));
        call.resolve();
    }

    /**
     * Route call audio: "speaker" | "bluetooth" | "wired" | "earpiece".
     * Returns what is actually in use — "auto" when the requested device
     * isn't connected, so the UI can reflect reality instead of intent.
     */
    @PluginMethod
    public void setAudioDevice(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context unavailable");
            return;
        }
        String requested = call.getString("device", "earpiece");
        JSObject ret = new JSObject();
        ret.put("device", CallCoordinator.setAudioDevice(context, requested));
        call.resolve(ret);
    }

    @PluginMethod
    public void getAudioDevice(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("device", CallCoordinator.getAudioDevice());
        call.resolve(ret);
    }

    // ------------------------------------------------------------------
    // Permission helpers. Requests are deliberately NOT issued here —
    // @capacitor/camera and @capacitor/local-notifications already own the
    // runtime request flows on the JS side; this plugin only reports truth.
    // ------------------------------------------------------------------

    // Named permissionGranted() — Capacitor's own Plugin base class already
    // defines hasPermission(String); overriding that would change bridge behavior.
    private boolean permissionGranted(String permission) {
        Context context = getContext();
        if (context == null) return false;
        return ContextCompat.checkSelfPermission(context, permission)
                == PackageManager.PERMISSION_GRANTED;
    }

    private boolean notificationsAllowed() {
        return notificationsAllowed(getContext());
    }

    /**
     * Static copies of the two permission checks, for the cold-start path:
     * SparkleFirebaseMessagingService evaluates them before the bridge (and
     * therefore any plugin instance) exists.
     */
    static boolean hasCallPermission(android.content.Context context, String permission) {
        if (context == null) return false;
        return ContextCompat.checkSelfPermission(context, permission)
                == PackageManager.PERMISSION_GRANTED;
    }

    static boolean notificationsAllowed(android.content.Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return true; // declared in the manifest, no runtime grant needed
        }
        return hasCallPermission(context, Manifest.permission.POST_NOTIFICATIONS);
    }

    /**
     * The only place call events enter the bridge. Plugin.notifyListeners(...)
     * is protected and declared in a different package, so CallCoordinator
     * (same package as this plugin, but not a Plugin subclass) cannot call it
     * directly — this hop makes the access legal, and keeps the event name in
     * one place. Called from the call stack for every state change.
     */
    void emitEvent(JSObject data) {
        try {
            notifyListeners(CallCoordinator.EVENT_TYPE, data, true);
        } catch (Exception ignored) {
            // Bridge torn down mid-call; the coordinator's snapshot still holds
            // the truth and the next getState() call reflects it.
        }
    }
}