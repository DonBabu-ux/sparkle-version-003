package com.sparkleapp.plugins;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.telecom.PhoneAccount;
import android.telecom.PhoneAccountHandle;
import android.telecom.TelecomManager;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.sparkleapp.R;

import java.lang.ref.WeakReference;

/**
 * Static coordination point for the Sparkle call stack.
 *
 * The media plane (WebRTC, signalling) lives in the WebView and is driven by
 * the frontend; this class owns everything the OS needs to treat an ongoing
 * Sparkle call as a real call:
 *
 *  - a self-managed Telecom {@link PhoneAccount} so the system UI (lock screen,
 *    car, watch) knows a call exists and its audio is VoIP,
 *  - notification channels (ring + ongoing) and the full-screen lock-screen
 *    intent, satisfying the USE_FULL_SCREEN_INTENT / FOREGROUND_SERVICE_* /
 *    MANAGE_OWN_CALLS permissions the manifest declares,
 *  - audio focus + MODE_IN_COMMUNICATION for the duration of a call,
 *  - a live call snapshot so events that fire before the JS listener attaches
 *    (cold ConnectionService bind, background notification action) are still
 *    recoverable via SparkleCall.getState().
 *
 * All entry points funnel here: the Capacitor plugin (JS-driven), the
 * notification actions (user-driven) and the ConnectionService callbacks
 * (system-driven).
 */
public final class CallCoordinator {
    private CallCoordinator() {}

    // ---- Call state exposed to JS (mirrors Telecom Connection state) ----
    public static final String STATE_IDLE = "idle";
    public static final String STATE_RINGING = "ringing";
    public static final String STATE_DIALING = "dialing";
    public static final String STATE_ACTIVE = "active";

    /** Emitted by SparkleCallPlugin as the "callEvent" event. */
    public static final String EVENT_TYPE = "callEvent";
    public static final String CHANNEL_RING = "sparkle_call_ring";
    public static final String CHANNEL_ONGOING = "sparkle_call_ongoing";
    public static final String PHONE_ACCOUNT_ID = "sparkle_call";
    public static final String DEEP_LINK_SCHEME = "sparkle";
    public static final String DEEP_LINK_HOST_CALL = "call";

    public static final int NOTIF_RING = 71001;
    public static final int ONGOING_NOTIFICATION_ID = 71002;

    /** Default ring window before a call auto-declines as missed (45s). */
    public static final int DEFAULT_RING_TIMEOUT_MS = 45_000;

    private static final Object LOCK = new Object();
    private static WeakReference<SparkleCallPlugin> pluginRef;
    private static volatile SparkleCallConnection activeConnection;
    private static volatile JSObject pendingIncoming; // info consumed by onCreateIncomingConnection
    private static volatile JSObject snapshot;
    private static volatile boolean focusAcquired;
    private static volatile int ringTimeoutMs = DEFAULT_RING_TIMEOUT_MS;

    private static final android.os.Handler MAIN = new android.os.Handler(android.os.Looper.getMainLooper());

    /** Application context captured on every entry point; the missed-ring
        timer and ConnectionService callbacks run without one. Always the
        application context — never an Activity — so this leaks nothing. */
    private static volatile android.content.Context appContext;

    private static android.content.Context remember(android.content.Context context) {
        if (context != null) {
            appContext = context.getApplicationContext();
        }
        return appContext;
    }

    static {
        JSObject initial = new JSObject();
        initial.put("state", STATE_IDLE);
        initial.put("peer", "");
        initial.put("displayName", "");
        initial.put("video", false);
        initial.put("muted", false);
        snapshot = initial;
    }

    // ------------------------------------------------------------------
    // Plugin wiring
    // ------------------------------------------------------------------

    static void attach(SparkleCallPlugin plugin) {
        synchronized (LOCK) {
            pluginRef = new WeakReference<>(plugin);
        }
    }

    static void detach(SparkleCallPlugin plugin) {
        synchronized (LOCK) {
            if (pluginRef != null && pluginRef.get() == plugin) {
                pluginRef = null;
            }
        }
    }

    private static void emit(String type, JSObject extra) {
        JSObject data = new JSObject();
        data.put("type", type);
        if (extra != null) {
            data.put("peer", extra.optString("peer", ""));
            data.put("displayName", extra.optString("displayName", ""));
            data.put("video", extra.optBoolean("video", false));
        }
        SparkleCallPlugin p;
        synchronized (LOCK) {
            p = pluginRef == null ? null : pluginRef.get();
        }
        if (p != null) {
            try {
                // Plugin.notifyListeners(String, JSObject, boolean) is protected
                // and SparkleCallPlugin lives in a different package from its
                // declaring class, so the bridge hop happens there — this keeps
                // the CommonJS-style emit point on the plugin where access is
                // legal. retainUntilConsumed = true so a callEvent listener
                // that attaches later (cold bridge, reloaded WebView) still
                // receives events that fired before it existed.
                p.emitEvent(data);
            } catch (Exception ignored) {
                // Bridge gone (WebView reloaded) — snapshot carries the state.
            }
        }
    }

    // ------------------------------------------------------------------
    // Call state
    // ------------------------------------------------------------------

    static JSObject getSnapshot() {
        return snapshot;
    }

    static SparkleCallConnection getActiveConnection() {
        return activeConnection;
    }

    private static JSObject base() {
        JSObject s = new JSObject();
        s.put("peer", snapshot.optString("peer", ""));
        s.put("displayName", snapshot.optString("displayName", ""));
        s.put("video", snapshot.optBoolean("video", false));
        s.put("muted", snapshot.optBoolean("muted", false));
        return s;
    }

    private static void setState(String state) {
        JSObject s = base();
        s.put("state", state);
        snapshot = s;
    }

    /** Called when an outgoing call begins (JS initiated the dialer). */
    static void startOutgoingCall(Context context, String peer, String displayName, boolean video) {
        remember(context);
        JSObject info = new JSObject();
        info.put("peer", peer);
        info.put("displayName", displayName);
        info.put("video", video);
        setState(STATE_IDLE);
        mergeInfo(info);
        setState(STATE_DIALING);
        ensureChannels(context);
        ensureRegistered(context);
        startCallService(context, video);
        boolean telecomDriven = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                TelecomManager tm = getTelecomManager(context);
                if (tm != null) {
                    // Self-managed: placeCall drives onCreateOutgoingConnection,
                    // which builds the Connection and flips it to ACTIVE.
                    Uri address = Uri.fromParts(PhoneAccount.SCHEME_TEL, peer, null);
                    tm.placeCall(address, new android.os.Bundle());
                    telecomDriven = true;
                }
            } catch (Exception e) {
                // SecurityException on OEM builds that lock Telecom down, or a
                // missing default-dialer on API 23-25. The foreground service
                // and notification path still work without Telecom.
                telecomDriven = false;
            }
        }
        emit("dialing", info);
        if (!telecomDriven) {
            emit("telecom_unavailable", info);
        }
    }

    /** Called when JS receives a signalling offer (incoming call). */
    static void reportIncomingCall(Context context, String peer, String displayName, boolean video) {
        remember(context);
        JSObject info = new JSObject();
        info.put("peer", peer);
        info.put("displayName", displayName);
        info.put("video", video);
        mergeInfo(info);
        setState(STATE_RINGING);
        pendingIncoming = info;
        ensureChannels(context);
        ensureRegistered(context);
        scheduleMissedRing();
        showRingNotification(context);
        boolean telecomDriven = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                TelecomManager tm = getTelecomManager(context);
                if (tm != null) {
                    // addNewIncomingCall binds SparkleCallConnectionService,
                    // which calls onCreateIncomingConnection below. On API < 26
                    // this requires default-dialer status, so it stays O+ only.
                    tm.addNewIncomingCall(phoneAccountHandle(context), new android.os.Bundle());
                    telecomDriven = true;
                }
            } catch (Exception e) {
                telecomDriven = false;
            }
        }
        emit("incoming", info);
        if (!telecomDriven) {
            emit("telecom_unavailable", info);
        }
    }

    private static void mergeInfo(JSObject info) {
        JSObject s = new JSObject();
        s.put("peer", info.optString("peer", ""));
        s.put("displayName", info.optString("displayName", ""));
        s.put("video", info.optBoolean("video", false));
        s.put("muted", snapshot.optBoolean("muted", false));
        s.put("state", snapshot.optString("state", STATE_IDLE));
        snapshot = s;
    }

    /** Called when the peer connects: ringing/dialing → active. */
    static void setConnected() {
        setState(STATE_ACTIVE);
        emit("connected", snapshot);
    }

    /** Answer from any surface: JS, the lock-screen UI, or the notification. */
    static void answer(Context context) {
        remember(context);
        MAIN.removeCallbacks(MISSED_RING_RUNNABLE);
        SparkleCallConnection c = activeConnection;
        boolean video = snapshot.optBoolean("video", false);
        if (c != null) {
            try {
                c.setInitialized();
                c.setActive();
            } catch (Exception ignored) {
                // Connection already destroyed by the system; service still runs.
            }
        }
        setState(STATE_ACTIVE);
        startCallService(context, video);
        cancelRing(context);
        launchAppForCall(context, "answer");
        emit("answered", snapshot);
    }

    /** Decline while ringing. */
    static void decline(Context context) {
        SparkleCallConnection c = activeConnection;
        if (c != null) {
            c.localDisconnected(android.telecom.DisconnectCause.REJECTED);
        }
        activeConnection = null;
        end(context, "declined");
    }

    /** Local hang-up while active. */
    static void hangUpLocal(Context context) {
        SparkleCallConnection c = activeConnection;
        if (c != null) {
            c.localDisconnected(android.telecom.DisconnectCause.LOCAL);
        }
        activeConnection = null;
        end(context, "ended");
    }

    /** System told us the incoming connection could not be created. */
    static void onTelecomIncomingFailed(Context context) {
        activeConnection = null;
        setState(STATE_IDLE);
        cancelRing(context);
        emit("telecom_unavailable", snapshot);
    }

    private static void end(Context context, String type) {
        setState(STATE_IDLE);
        MAIN.removeCallbacks(MISSED_RING_RUNNABLE);
        android.content.Context c = context != null ? context.getApplicationContext() : appContext;
        if (c != null) {
            stopCallService(c);
            cancelRing(c);
            releaseAudioFocus(c);
        }
        emit(type, snapshot);
    }

    static void setMuted(boolean muted) {
        JSObject s = base();
        s.put("state", snapshot.optString("state", STATE_IDLE));
        s.put("muted", muted);
        snapshot = s;
        // The WebRTC mute switch itself is JS-side; this keeps the native
        // snapshot (and therefore Android Auto / Wear surfaces) in sync.
        emit("muted", snapshot);
    }

    // ------------------------------------------------------------------
    // Missed-call timeout (item: rings that nobody answers must end)
    // ------------------------------------------------------------------

    static void setRingTimeoutMs(int ms) {
        ringTimeoutMs = Math.max(5_000, ms);
    }

    static int getRingTimeoutMs() {
        return ringTimeoutMs;
    }

    private static void scheduleMissedRing() {
        MAIN.removeCallbacks(MISSED_RING_RUNNABLE);
        MAIN.postDelayed(MISSED_RING_RUNNABLE, ringTimeoutMs);
    }

    private static void onRingTimedOut() {
        if (!STATE_RINGING.equals(snapshot.optString("state", STATE_IDLE))) {
            return; // answered/declined in the meantime
        }
        SparkleCallConnection c = activeConnection;
        if (c != null) {
            c.localDisconnected(android.telecom.DisconnectCause.MISSED);
        }
        activeConnection = null;
        end(null, "missed");
    }

    /**
     * Declared at the bottom of the class on purpose: a method reference in a
     * static initializer may not reference a method declared later in the
     * class (illegal forward reference). Must be one stable instance because
     * removeCallbacks matches by identity.
     */
    private static final Runnable MISSED_RING_RUNNABLE = CallCoordinator::onRingTimedOut;

    // ------------------------------------------------------------------
    // Connections (system-driven via SparkleCallConnectionService)
    // ------------------------------------------------------------------

    static SparkleCallConnection createIncomingConnection(Context context) {
        JSObject info = pendingIncoming != null ? pendingIncoming : snapshot;
        SparkleCallConnection c = new SparkleCallConnection(context.getApplicationContext(), info, true);
        activeConnection = c;
        pendingIncoming = null;
        return c;
    }

    static SparkleCallConnection createOutgoingConnection(Context context) {
        SparkleCallConnection c = new SparkleCallConnection(context.getApplicationContext(), snapshot, false);
        activeConnection = c;
        return c;
    }

    private static TelecomManager getTelecomManager(Context context) {
        return (TelecomManager) context.getSystemService(Context.TELECOM_SERVICE);
    }

    private static PhoneAccountHandle phoneAccountHandle(Context context) {
        ComponentName cn = new ComponentName(context.getApplicationContext(), SparkleCallConnectionService.class);
        return new PhoneAccountHandle(cn, PHONE_ACCOUNT_ID);
    }

    /**
     * Registers the self-managed PhoneAccount. Called from plugin load() and
     * again before every call, because Telecom drops accounts after a reboot.
     * API < 26 has no self-managed support (and API 23-25 requires
     * default-dialer status for addNewIncomingCall), so those devices run
     * notification-only mode.
     */
    static void ensureRegistered(Context context) {
        remember(context);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        try {
            TelecomManager tm = getTelecomManager(context);
            if (tm == null) return;
            PhoneAccountHandle handle = phoneAccountHandle(context);
            if (tm.getPhoneAccount(handle) != null) return;
            PhoneAccount account = PhoneAccount.builder(handle, "Sparkle calls")
                    .setCapabilities(PhoneAccount.CAPABILITY_SELF_MANAGED
                            | PhoneAccount.CAPABILITY_SUPPORTS_VIDEO_CALLING)
                    .addSupportedUriScheme(PhoneAccount.SCHEME_TEL)
                    .build();
            tm.registerPhoneAccount(account);
        } catch (Exception ignored) {
            // OEM lock-downs and Play-sandbox devices land here; the rest of
            // the call stack (FGS + full-screen notification) is unaffected.
        }
    }

    // ------------------------------------------------------------------
    // Notifications
    // ------------------------------------------------------------------

    static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL_RING) == null) {
            NotificationChannel ring = new NotificationChannel(CHANNEL_RING,
                    context.getString(R.string.call_channel_ring_name),
                    NotificationManager.IMPORTANCE_HIGH);
            ring.setDescription(context.getString(R.string.call_channel_ring_desc));
            ring.enableVibration(true);
            ring.setSound(android.provider.Settings.System.DEFAULT_RINGTONE_URI,
                    new android.media.AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build());
            nm.createNotificationChannel(ring);
        }
        if (nm.getNotificationChannel(CHANNEL_ONGOING) == null) {
            NotificationChannel ongoing = new NotificationChannel(CHANNEL_ONGOING,
                    context.getString(R.string.call_channel_ongoing_name),
                    NotificationManager.IMPORTANCE_LOW);
            ongoing.setDescription(context.getString(R.string.call_channel_ongoing_desc));
            ongoing.setSound(null, null);
            ongoing.enableVibration(false);
            nm.createNotificationChannel(ongoing);
        }
    }

    private static void showRingNotification(Context context) {
        String name = snapshot.optString("displayName", "");
        String title = name.isEmpty() ? context.getString(R.string.call_incoming_unknown) : name;
        boolean video = snapshot.optBoolean("video", false);
        PendingIntent content = activityIntent(context, IncomingCallActivity.class, 0);
        Notification n = new NotificationCompat.Builder(context, CHANNEL_RING)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(context.getColor(R.color.sparkle_notification_color))
                .setContentTitle(title)
                .setContentText(context.getString(video
                        ? R.string.call_incoming_video : R.string.call_incoming_audio))
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setPriority(NotificationCompat.PRIORITY_HIGH) // pre-O path
                .setOngoing(true)
                .setAutoCancel(false)
                .setContentIntent(content)
                // The full-screen intent is what the manifest's
                // USE_FULL_SCREEN_INTENT permission pays for: on locked
                // devices the system launches IncomingCallActivity directly.
                .setFullScreenIntent(content, true)
                .addAction(0, context.getString(R.string.call_action_answer),
                        serviceIntent(context, 1, CallService.ACTION_ANSWER))
                .addAction(0, context.getString(R.string.call_action_decline),
                        serviceIntent(context, 2, CallService.ACTION_DECLINE))
                .build();
        try {
            NotificationManagerCompat.from(context).notify(NOTIF_RING, n);
        } catch (SecurityException ignored) {
            // POST_NOTIFICATIONS missing (OS revokes between check and use).
        }
    }

    /**
     * The ongoing call notification. Used by CallService as the notification
     * it must pass to startForeground(), and by showOngoingNotification() for
     * later updates (mute/state changes) while the service is running.
     */
    static Notification buildOngoingNotification(Context context, boolean video, long startedAt) {
        String name = snapshot.optString("displayName", "");
        String peer = snapshot.optString("peer", "");
        String title = name.isEmpty()
                ? context.getString(R.string.call_ongoing_default)
                : name;
        String text = context.getString(video ? R.string.call_ongoing_video : R.string.call_ongoing_audio);
        if (!peer.isEmpty() && !peer.equals(name)) {
            text = peer + " · " + text;
        }
        PendingIntent content = activityIntent(context, com.sparkleapp.MainActivity.class, 3);
        return new NotificationCompat.Builder(context, CHANNEL_ONGOING)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(context.getColor(R.color.sparkle_notification_color))
                .setContentTitle(title)
                .setContentText(text)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setWhen(startedAt)
                .setUsesChronometer(true)
                .setContentIntent(content)
                .addAction(0, context.getString(R.string.call_action_end),
                        serviceIntent(context, 4, CallService.ACTION_END))
                .build();
    }

    static void showOngoingNotification(Context context, boolean video) {
        try {
            NotificationManagerCompat.from(context).notify(ONGOING_NOTIFICATION_ID,
                    buildOngoingNotification(context, video, System.currentTimeMillis()));
        } catch (SecurityException ignored) {
        }
    }

    static void cancelRing(Context context) {
        NotificationManagerCompat.from(context).cancel(NOTIF_RING);
    }

    static void cancelOngoing(Context context) {
        NotificationManagerCompat.from(context).cancel(ONGOING_NOTIFICATION_ID);
    }

    private static PendingIntent activityIntent(Context context, Class<?> activity, int requestCode) {
        Intent i = new Intent(context, activity)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, requestCode, i, mutableFlagsForApi());
    }

    /** Notification action buttons get a foreground-service PendingIntent so the FGS start is never rejected. */
    private static PendingIntent serviceIntent(Context context, int requestCode, String action) {
        Intent i = new Intent(context, CallService.class).setAction(action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return PendingIntent.getForegroundService(context, requestCode, i, flags);
        }
        return PendingIntent.getService(context, requestCode, i, flags);
    }

    private static int mutableFlagsForApi() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.FLAG_UPDATE_CURRENT;
    }

    // ------------------------------------------------------------------
    // FGS control
    // ------------------------------------------------------------------

    static void startCallService(Context context, boolean video) {
        Intent i = new Intent(context, CallService.class)
                .setAction(video ? CallService.ACTION_START_VIDEO : CallService.ACTION_START_VOICE);
        ContextCompat.startForegroundService(context, i);
    }

    static void stopCallService(Context context) {
        context.stopService(new Intent(context, CallService.class));
    }

    // ------------------------------------------------------------------
    // Audio focus (MODIFY_AUDIO_SETTINGS)
    // ------------------------------------------------------------------

    static void acquireAudioFocus(Context context) {
        if (focusAcquired) return;
        AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (am == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AudioManager.OnAudioFocusChangeListener listener = change -> {
                };
                AudioFocusRequest request = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                        .setAudioAttributes(new AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                .build())
                        .setOnAudioFocusChangeListener(listener)
                        .build();
                am.requestAudioFocus(request);
            } else {
                am.requestAudioFocus(null, AudioManager.STREAM_VOICE_CALL,
                        AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
            }
            am.setMode(AudioManager.MODE_IN_COMMUNICATION);
            focusAcquired = true;
        } catch (Exception ignored) {
        }
    }

    // ------------------------------------------------------------------
    // Audio device routing (MODIFY_AUDIO_SETTINGS + BLUETOOTH on <=30)
    // ------------------------------------------------------------------

    /**
     * Routes call audio. Android 12+ uses setCommunicationDevice(); below that
     * the only lever is speakerphone + Bluetooth SCO — which is why the legacy
     * BLUETOOTH / BLUETOOTH_ADMIN permissions (maxSdk 30) were added to the
     * manifest: without them a BT headset is unreachable on API 22-30.
     *
     * @return the device actually selected ("speaker" | "bluetooth" | "wired"
     *         | "earpiece" | "auto" when the requested route is unavailable)
     */
    static String setAudioDevice(Context context, String requested) {
        AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (am == null) return "auto";
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                int wantedType;
                switch (requested == null ? "" : requested) {
                    case "speaker":
                        wantedType = android.media.AudioDeviceInfo.TYPE_BUILTIN_SPEAKER;
                        break;
                    case "bluetooth":
                        wantedType = android.media.AudioDeviceInfo.TYPE_BLUETOOTH_SCO;
                        break;
                    case "wired":
                        wantedType = android.media.AudioDeviceInfo.TYPE_WIRED_HEADSET;
                        break;
                    case "earpiece":
                    default:
                        wantedType = android.media.AudioDeviceInfo.TYPE_BUILTIN_EARPIECE;
                        break;
                }
                for (android.media.AudioDeviceInfo device : am.getAvailableCommunicationDevices()) {
                    if (device.getType() == wantedType) {
                        am.setCommunicationDevice(device);
                        currentAudioDevice = requested;
                        emitAudioDevice(requested);
                        return requested;
                    }
                }
                // Device not connected right now — fall back to whatever the
                // system picks, and report that truth to JS.
                am.clearCommunicationDevice();
                currentAudioDevice = "auto";
                emitAudioDevice("auto");
                return "auto";
            }

            boolean speaker = "speaker".equals(requested);
            if ("bluetooth".equals(requested)) {
                am.setSpeakerphoneOn(false);
                am.startBluetoothSco();
                am.setBluetoothScoOn(true);
                currentAudioDevice = "bluetooth";
            } else {
                am.stopBluetoothSco();
                am.setBluetoothScoOn(false);
                am.setSpeakerphoneOn(speaker);
                currentAudioDevice = speaker ? "speaker" : "earpiece";
            }
            emitAudioDevice(currentAudioDevice);
            return currentAudioDevice;
        } catch (Exception e) {
            return currentAudioDevice;
        }
    }

    private static volatile String currentAudioDevice = "earpiece";

    static String getAudioDevice() {
        return currentAudioDevice;
    }

    private static void emitAudioDevice(String device) {
        JSObject data = new JSObject();
        data.put("type", "audio_device");
        data.put("device", device);
        SparkleCallPlugin p;
        synchronized (LOCK) {
            p = pluginRef == null ? null : pluginRef.get();
        }
        if (p != null) {
            try {
                p.emitEvent(data);
            } catch (Exception ignored) {
            }
        }
    }

    static void releaseAudioFocus(Context context) {
        if (!focusAcquired) return;
        AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (am != null) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    AudioManager.OnAudioFocusChangeListener listener = change -> {
                    };
                    AudioFocusRequest request = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                            .setOnAudioFocusChangeListener(listener)
                            .build();
                    am.abandonAudioFocusRequest(request);
                } else {
                    am.abandonAudioFocus(null);
                }
                am.setMode(AudioManager.MODE_NORMAL);
            } catch (Exception ignored) {
            }
        }
        focusAcquired = false;
    }

    // ------------------------------------------------------------------
    // Deep link into the SPA's call screen
    // ------------------------------------------------------------------

    /**
     * Reuses the existing custom-scheme plumbing ({@code sparkle://}) that
     * @capacitor/app already delivers to JS as appUrlOpen, so the call UI
     * (which lives in the WebView) opens natively without the native layer
     * maintaining a parallel dialer UI.
     */
    static void launchAppForCall(Context context, String action) {
        try {
            Uri uri = new Uri.Builder()
                    .scheme(DEEP_LINK_SCHEME)
                    .authority(DEEP_LINK_HOST_CALL)
                    .appendQueryParameter("peer", snapshot.optString("peer", ""))
                    .appendQueryParameter("displayName", snapshot.optString("displayName", ""))
                    .appendQueryParameter("video", String.valueOf(snapshot.optBoolean("video", false)))
                    .appendQueryParameter("action", action)
                    .build();
            Intent i = new Intent(context, com.sparkleapp.MainActivity.class)
                    .setAction(Intent.ACTION_VIEW)
                    .setData(uri)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(i);
        } catch (Exception ignored) {
            // Background-activity-start restrictions on some OEMs; the
            // WebView UI is often already in front for JS-driven answers.
        }
    }
}