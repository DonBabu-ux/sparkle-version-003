package com.sparkleapp.plugins;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

import com.getcapacitor.JSObject;
import com.sparkleapp.R;

/**
 * The lock-screen surface for incoming Sparkle calls. Launched two ways:
 *
 *  1. the full-screen intent of the ring notification — what
 *     USE_FULL_SCREEN_INTENT buys us on locked devices (Android 14+ only grants
 *     that permission to call/alarm-category apps, so the SPA must still be
 *     able to show calls without it),
 *  2. a content-intent tap on the ring notification.
 *
 * It exists so a Sparkle call is answerable without unlocking the phone. It is
 * NOT a second dialer: every button routes through CallCoordinator into the
 * exact same state machine the WebView uses, and on answer it hands over to the
 * SPA via the existing sparkle://call deep link (@capacitor/app's appUrlOpen),
 * so the media UI stays in the web layer as the single source of truth.
 */
public class IncomingCallActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        showOverLockScreen();
        setContentView(R.layout.activity_incoming_call);

        JSObject snap = CallCoordinator.getSnapshot();
        String name = snap.optString("displayName", "");
        boolean video = snap.optBoolean("video", false);

        TextView title = findViewById(R.id.call_caller_name);
        title.setText(name.isEmpty() ? getString(R.string.call_incoming_unknown) : name);

        TextView subtitle = findViewById(R.id.call_kind);
        subtitle.setText(getString(video ? R.string.call_incoming_video : R.string.call_incoming_audio));

        Button answer = findViewById(R.id.call_answer);
        answer.setOnClickListener(v -> {
            CallCoordinator.answer(getApplicationContext());
            finish();
        });

        Button decline = findViewById(R.id.call_decline);
        decline.setOnClickListener(v -> {
            CallCoordinator.decline(getApplicationContext());
            finish();
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // setIntent keeps the extras readable if the activity is re-launched
        // while already showing (double-tap on the notification, Auto/Wear).
        if (intent != null && CallService.ACTION_DECLINE.equals(intent.getAction())) {
            CallCoordinator.decline(getApplicationContext());
            finish();
        }
    }

    /**
     * API 27+ uses the activity attributes (also mirrored in the manifest for
     * clarity); below that, window flags are the only route to show over the
     * keyguard and wake the screen.
     */
    private void showOverLockScreen() {
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
    }
}