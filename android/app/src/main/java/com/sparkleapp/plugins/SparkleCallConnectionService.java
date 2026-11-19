package com.sparkleapp.plugins;

import android.content.Context;
import android.telecom.Connection;
import android.telecom.ConnectionRequest;
import android.telecom.ConnectionService;
import android.telecom.PhoneAccountHandle;

/**
 * The Telecom-side entry point. The system binds this service (via the
 * manifest's android.telecom.ConnectionService intent filter, protected by
 * BIND_TELECOM_CONNECTION_SERVICE so only the platform can bind it) whenever
 * our self-managed PhoneAccount is used: addNewIncomingCall() from the plugin
 * and placeCall() from an outgoing dial.
 *
 * It is deliberately dumb — it just hands each request to a single
 * SparkleCallConnection. All state lives in CallCoordinator, which is also
 * where the plugin and the notification actions converge, so there is exactly
 * one source of truth no matter which surface started the call.
 *
 * Note on minSdk: this class only ever gets bound on API 26+ (the plugin guards
 * addNewIncomingCall/placeCall with a Build.VERSION check), where
 * PROPERTY_SELF_MANAGED exists. On API 22-25 incoming calls run through the
 * notification + SPA path only, which is fine for the <1% of devices there.
 */
public class SparkleCallConnectionService extends ConnectionService {

    @Override
    public Connection onCreateOutgoingConnection(PhoneAccountHandle connectionManagerPhoneAccount,
                                                  ConnectionRequest request) {
        Context context = getApplicationContext();
        if (CallCoordinator.getActiveConnection() != null) {
            CallCoordinator.getActiveConnection().localDisconnected(android.telecom.DisconnectCause.CANCELED);
        }
        return CallCoordinator.createOutgoingConnection(context);
    }

    @Override
    public Connection onCreateIncomingConnection(PhoneAccountHandle connectionManagerPhoneAccount,
                                                 ConnectionRequest request) {
        Context context = getApplicationContext();
        if (CallCoordinator.getActiveConnection() != null) {
            CallCoordinator.getActiveConnection().localDisconnected(android.telecom.DisconnectCause.CANCELED);
        }
        return CallCoordinator.createIncomingConnection(context);
    }

    @Override
    public void onCreateIncomingConnectionFailed(PhoneAccountHandle connectionManagerPhoneAccount,
                                                 ConnectionRequest request) {
        // Some OEM builds refuse self-managed connections while the app is in
        // the background. The ring notification and the SPA still work, so
        // mirror the failure instead of hanging in "ringing" forever.
        CallCoordinator.onTelecomIncomingFailed(getApplicationContext());
    }

    @Override
    public void onCreateOutgoingConnectionFailed(PhoneAccountHandle connectionManagerPhoneAccount,
                                                ConnectionRequest request) {
        // Dialer surface rejected the call (common on locked-down OEM builds);
        // end it locally so JS and the notification converge on "ended".
        CallCoordinator.hangUpLocal(getApplicationContext());
    }
}