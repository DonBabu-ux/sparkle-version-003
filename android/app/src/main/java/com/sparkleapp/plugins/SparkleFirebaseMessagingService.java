package com.sparkleapp.plugins;

import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Cold-start incoming calls.
 *
 * Problem this solves: the socket.io signalling path is the app's live call
 * path, but it only works while the JS process is alive. If the phone was idle
 * and the app got killed, only an FCM data message wakes it — and Capacitor's
 * own MessagingService owns the MESSAGING_EVENT filter, so it would forward
 * the call payload to JS and stop there.
 *
 * How it works:
 *  - Declared in the *app* manifest with the same MESSAGING_EVENT intent
 *    filter. App-manifest entries beat library-manifest entries (Capacitor's
 *    service) on equal priority, so GMS hands every FCM message to this
 *    service first. Non-call messages are delegated back into the Capacitor
 *    plugin via its public static sendRemoteMessage(), and tokens via
 *    onNewToken() — existing push behaviour is preserved exactly.
 *  - Call payloads (`type: "call"` in the data map) are intercepted here and
 *    run through CallCoordinator.reportIncomingCall(), which registers the
 *    PhoneAccount, posts the full-screen ring notification and creates the
 *    Telecom connection. The bridge is cold at this point, so the call UI is
 *    the native one (IncomingCallActivity) until the user answers and the SPA
 *    takes over via the sparkle://call deep link. State that fires before the
 *    WebView wakes up is recoverable through SparkleCall.getState().
 *
 * Expected payload contract (sent from the backend, high priority, data-only):
 *   { "type": "call", "peer": "<caller id>", "displayName": "<name>",
 *     "video": "true|false" }
 */
public class SparkleFirebaseMessagingService extends FirebaseMessagingService {

    /** Type value that marks an FCM data message as a call alert. */
    public static final String CALL_TYPE = "call";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        String type = data != null ? data.get("type") : null;

        if (CALL_TYPE.equals(type)) {
            handleCallMessage(data);
            return;
        }

        // Everything else stays exactly as it was: hand it to Capacitor's
        // push-notifications plugin, which owns tokens, the JS
        // pushNotificationReceived event and notification-message rendering.
        PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
    }

    @Override
    public void onNewToken(String token) {
        // Capacitor's plugin registers the token with the bridge; without this
        // forward push would stop working the moment FCM rotates the token.
        PushNotificationsPlugin.onNewToken(token);
    }

    private void handleCallMessage(Map<String, String> data) {
        String peer = data.get("peer") != null ? data.get("peer") : "";
        String displayName = data.get("displayName") != null ? data.get("displayName") : "";
        boolean video = "true".equalsIgnoreCase(data.get("video"));

        boolean micGranted = SparkleCallPlugin.hasCallPermission(this, android.Manifest.permission.RECORD_AUDIO);
        boolean notificationsAllowed = SparkleCallPlugin.notificationsAllowed(this);
        if (!micGranted || !notificationsAllowed) {
            // No use ringing: the user has not granted call permissions, so the
            // system would swallow both the notification and the mic FGS. The
            // caller stays "unreachable" — the same behaviour iOS/Miui give
            // when the app has never had the permissions.
            return;
        }

        // reportIncomingCall is idempotent per call: a second push while a ring
        // is still up just re-asserts the same notification and Telecom
        // connection, and does not stack duplicates.
        CallCoordinator.reportIncomingCall(getApplicationContext(), peer, displayName, video);
    }
}