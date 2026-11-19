package com.sparkleapp.plugins;

import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

/**
 * Foreground service that keeps a Sparkle call alive — the reason the manifest
 * declares FOREGROUND_SERVICE, FOREGROUND_SERVICE_MICROPHONE and
 * FOREGROUND_SERVICE_CAMERA.
 *
 * Types are chosen from the live call state:
 *  - voice call → FOREGROUND_SERVICE_TYPE_MICROPHONE (keeps WebRTC audio
 *    capture legal when the app leaves the foreground)
 *  - video call → MICROPHONE | CAMERA
 *
 * Started three ways: by the plugin when a call is answered, by the ongoing
 * notification actions (End), and by the ring notification actions (Answer /
 * Decline) via PendingIntent.getForegroundService — never getService, so a
 * background action can always promote the service in time.
 *
 * README-style note for whoever debugs this next: on Android 14+ the type must
 * match a granted permission at start time (RECORD_AUDIO / CAMERA) and the
 * start must come from a foreground context — the plugin checks both before
 * delegating here, and SecurityException is caught defensively below.
 */
public class CallService extends Service {

    public static final String ACTION_START_VOICE = "com.sparkleapp.call.START_VOICE";
    public static final String ACTION_START_VIDEO = "com.sparkleapp.call.START_VIDEO";
    public static final String ACTION_ANSWER = "com.sparkleapp.call.ANSWER";
    public static final String ACTION_DECLINE = "com.sparkleapp.call.DECLINE";
    public static final String ACTION_END = "com.sparkleapp.call.END";

    /** True once a START_* action has been promoted; used for the camera type. */
    private boolean videoEnabled;

    /** Screen-off-when-held-to-ear lock for voice calls; null for video. */
    private PowerManager.WakeLock proximityLock;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || intent.getAction() == null) {
            // START_STICKY redelivery with a null intent after a process kill:
            // no call to resume here, exit cleanly.
            stopSelf();
            return START_NOT_STICKY;
        }
        String action = intent.getAction();
        switch (action) {
            case ACTION_START_VOICE:
            case ACTION_START_VIDEO:
                videoEnabled = ACTION_START_VIDEO.equals(action);
                enterForeground();
                break;
            case ACTION_ANSWER:
                // Answering from the shade/headset: promote the call natively.
                // launchAppForCall() is deliberately NOT called from here —
                // background-activity-start rules forbid it from a service on
                // Android 10+; the ring notification's content intent and the
                // IncomingCallActivity path cover opening the UI.
                CallCoordinator.answer(getApplicationContext());
                if (CallCoordinator.STATE_IDLE.equals(
                        CallCoordinator.getSnapshot().optString("state", CallCoordinator.STATE_IDLE))) {
                    // answer() found nothing to answer (race with decline).
                    stopSelf();
                } else {
                    enterForeground();
                }
                break;
            case ACTION_DECLINE:
                CallCoordinator.decline(getApplicationContext());
                stopSelf();
                break;
            case ACTION_END:
                CallCoordinator.hangUpLocal(getApplicationContext());
                stopSelf();
                break;
            default:
                stopSelf();
                break;
        }
        return START_STICKY;
    }

    private void enterForeground() {
        CallCoordinator.acquireAudioFocus(getApplicationContext());
        acquireProximityLock();
        try {
            android.app.Notification notification =
                    CallCoordinator.buildOngoingNotification(getApplicationContext(), videoEnabled, System.currentTimeMillis());
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                int types = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
                if (videoEnabled) {
                    types |= ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA;
                }
                startForeground(CallCoordinator.ONGOING_NOTIFICATION_ID, notification, types);
            } else {
                startForeground(CallCoordinator.ONGOING_NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            // Missing RECORD_AUDIO grant or a rejected background start:
            // never crash the process over a notification.
            stopSelf();
        }
    }

    @Override
    public void onDestroy() {
        releaseProximityLock();
        CallCoordinator.cancelOngoing(getApplicationContext());
        CallCoordinator.releaseAudioFocus(getApplicationContext());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        super.onDestroy();
    }

    // ------------------------------------------------------------------
    // Proximity: blank the screen when the phone is held to the ear.
    //
    // PROXIMITY_SCREEN_OFF_WAKE_LOCK is the right primitive (the framework
    // watches the sensor for us — no SensorManager plumbing) and it is
    // covered by the existing WAKE_LOCK declaration. Voice only: in a video
    // call the user is looking at the screen, so proximity is skipped and any
    // held lock is released.
    // ------------------------------------------------------------------

    private void acquireProximityLock() {
        if (videoEnabled) return;
        try {
            if (proximityLock == null) {
                PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
                proximityLock = pm.newWakeLock(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK,
                        "sparkle:call-proximity");
                proximityLock.setReferenceCounted(false);
            }
            if (!proximityLock.isHeld()) {
                proximityLock.acquire();
            }
        } catch (Exception ignored) {
            // Some OEM locks block this; calls still work, just brighter.
        }
    }

    private void releaseProximityLock() {
        try {
            if (proximityLock != null && proximityLock.isHeld()) {
                proximityLock.release();
            }
        } catch (Exception ignored) {
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}