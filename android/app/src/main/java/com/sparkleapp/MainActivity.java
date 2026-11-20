package com.sparkleapp;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;
import com.sparkleapp.plugins.CallPermissionsPlugin;
import com.sparkleapp.plugins.MediaStoreSaver;
import com.sparkleapp.plugins.PrivacyProtectionPlugin;
import com.sparkleapp.plugins.SparkleInsetsPlugin;

public class MainActivity extends BridgeActivity {

    private static final int MEDIA_PERMISSION_REQUEST_CODE = 9001;
    private Runnable pendingMediaPermissionCallback;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PrivacyProtectionPlugin.class);
        registerPlugin(SparkleInsetsPlugin.class);
        registerPlugin(MediaStoreSaver.class);
        registerPlugin(CallPermissionsPlugin.class);
        super.onCreate(savedInstanceState);

        // Install SparkleWebChromeClient to guarantee WebRTC camera and microphone
        // permissions are granted immediately to the WebView without timeout.
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().setWebChromeClient(new SparkleWebChromeClient(this.bridge, this));
        }

        enableEdgeToEdge();
        forceKeyboardMode();
    }

    public void requestMediaPermissionsFromWeb(String[] permissions, Runnable callback) {
        this.pendingMediaPermissionCallback = callback;
        ActivityCompat.requestPermissions(this, permissions, MEDIA_PERMISSION_REQUEST_CODE);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == MEDIA_PERMISSION_REQUEST_CODE) {
            if (pendingMediaPermissionCallback != null) {
                Runnable cb = pendingMediaPermissionCallback;
                pendingMediaPermissionCallback = null;
                cb.run();
            }
        }
    }

    private void forceKeyboardMode() {
        try {
            getWindow().setSoftInputMode(
                android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING);
        } catch (Exception e) {
            android.util.Log.w("SparkleMain", "Could not set SOFT_INPUT_ADJUST_NOTHING", e);
        }
    }

    private void enableEdgeToEdge() {
        try {
            Window window = getWindow();
            WindowCompat.setDecorFitsSystemWindows(window, false);
            window.setStatusBarColor(Color.TRANSPARENT);
            window.setNavigationBarColor(Color.TRANSPARENT);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                window.setStatusBarContrastEnforced(false);
            }
        } catch (Exception ignored) {}
    }
}
