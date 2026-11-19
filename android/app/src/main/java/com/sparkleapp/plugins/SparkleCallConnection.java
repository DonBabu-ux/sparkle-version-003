package com.sparkleapp.plugins;

import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.telecom.Connection;
import android.telecom.DisconnectCause;
import android.telecom.TelecomManager;
import android.telecom.VideoProfile;

import com.getcapacitor.JSObject;

/**
 * One Sparkle call as the Android Telecom framework sees it: a self-managed
 * VoIP connection (PROPERTY_SELF_MANAGED + setAudioModeIsVoip(true)), so the
 * system knows the audio is ours and never tries to route it through the
 * telephony stack.
 *
 * The system (and only the system) drives the callbacks here:
 *  onAnswer()  - answered from Android Auto / Wear / a wired headset
 *  onReject()  - rejected from those surfaces
 *  onDisconnect()/onAbort() - the user ended the call from system UI
 *
 * Each one routes into the exact same CallCoordinator paths the JS plugin
 * uses, so the WebView hears every transition through one callEvent
 * subscription. The display name is surfaced to the system UI via
 * setCallerDisplayName (API 26+) with presentation ALLOWED — Sparkle contacts
 * are already known to the user, so spoofing risk is minimal.
 */
public class SparkleCallConnection extends Connection {

    private final Context appContext;
    private final boolean incoming;

    public SparkleCallConnection(Context context, JSObject info, boolean incoming) {
        this.appContext = context.getApplicationContext();
        this.incoming = incoming;
        String peer = info.optString("peer", "");
        String displayName = info.optString("displayName", "");
        boolean video = info.optBoolean("video", false);

        setAddress(Uri.fromParts(android.telecom.PhoneAccount.SCHEME_TEL, peer, null),
                TelecomManager.PRESENTATION_ALLOWED);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Self-managed requires API 26; the service is bound only on O+
            // (see SparkleCallConnectionService), but guard for safety.
            setConnectionProperties(Connection.PROPERTY_SELF_MANAGED);
            setCallerDisplayName(displayName, TelecomManager.PRESENTATION_ALLOWED);
        }
        setAudioModeIsVoip(true);
        if (video && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            setVideoState(VideoProfile.STATE_BIDIRECTIONAL);
        }
        setInitializing();
        if (incoming) {
            setRinging();
        } else {
            setDialing();
        }
        setInitialized();
    }

    @Override
    public void onAnswer() {
        // System surface answered the call (Auto/Wear/headset). The WebView
        // learns about it through CallCoordinator.answer() → callEvent.
        CallCoordinator.answer(appContext);
    }

    @Override
    public void onReject() {
        CallCoordinator.decline(appContext);
    }

    @Override
    public void onDisconnect() {
        CallCoordinator.hangUpLocal(appContext);
    }

    @Override
    public void onAbort() {
        // Remote side ended before we connected.
        CallCoordinator.hangUpLocal(appContext);
    }

    /** Tear the connection down from our side; safe to call more than once. */
    public void localDisconnected(int cause) {
        try {
            // The (int) constructor is deprecated from API 24 but is the only
            // overload present on every supported API level — the richer
            // constructors were added later, and compileSdk-only usage of them
            // would NoSuchMethodError on API 22-23 devices.
            @SuppressWarnings("deprecation")
            DisconnectCause dc = new DisconnectCause(cause);
            setDisconnected(dc);
            destroy();
        } catch (Exception ignored) {
            // Already destroyed by the framework (e.g. onConnectionRemoved).
        }
    }
}