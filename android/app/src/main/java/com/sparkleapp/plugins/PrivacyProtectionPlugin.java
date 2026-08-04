package com.sparkleapp.plugins;

import android.app.Activity;
import android.database.ContentObserver;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PrivacyProtection")
public class PrivacyProtectionPlugin extends Plugin {

    private boolean isSecureEnabled = false;
    private Object screenCaptureCallback;
    private ContentObserver screenshotObserver;
    private long lastDetectionTime = 0;

    @Override
    public void load() {
        super.load();
        registerNativeCaptureListeners();
    }

    @PluginMethod
    public void enablePrivacyProtection(PluginCall call) {
        final Activity activity = getActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> {
                try {
                    activity.getWindow().setFlags(
                        WindowManager.LayoutParams.FLAG_SECURE,
                        WindowManager.LayoutParams.FLAG_SECURE
                    );
                    isSecureEnabled = true;
                    JSObject ret = new JSObject();
                    ret.put("enabled", true);
                    call.resolve(ret);
                } catch (Exception e) {
                    call.reject("Failed to enable FLAG_SECURE: " + e.getMessage());
                }
            });
        } else {
            call.reject("Activity is null");
        }
    }

    @PluginMethod
    public void disablePrivacyProtection(PluginCall call) {
        final Activity activity = getActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> {
                try {
                    activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                    isSecureEnabled = false;
                    JSObject ret = new JSObject();
                    ret.put("enabled", false);
                    call.resolve(ret);
                } catch (Exception e) {
                    call.reject("Failed to clear FLAG_SECURE: " + e.getMessage());
                }
            });
        } else {
            call.reject("Activity is null");
        }
    }

    @PluginMethod
    public void isPrivacyProtectionEnabled(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("enabled", isSecureEnabled);
        call.resolve(ret);
    }

    private void registerNativeCaptureListeners() {
        final Activity activity = getActivity();
        if (activity == null) return;

        // Android 14+ (API Level 34+) Official ScreenCaptureCallback
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                Activity.ScreenCaptureCallback callback = new Activity.ScreenCaptureCallback() {
                    @Override
                    public void onScreenCaptured() {
                        notifyCaptureAttempt("API_SCREENSHOT_CALLBACK");
                    }
                };
                activity.registerScreenCaptureCallback(activity.getMainExecutor(), callback);
                screenCaptureCallback = callback;
            } catch (Exception e) {
                // Fallback gracefully if API not supported by OEM build
            }
        }

        // Legacy ContentObserver Fallback for Android < 34
        try {
            screenshotObserver = new ContentObserver(new Handler(Looper.getMainLooper())) {
                @Override
                public void onChange(boolean selfChange, Uri uri) {
                    super.onChange(selfChange, uri);
                    if (uri != null && uri.toString().contains(MediaStore.Images.Media.EXTERNAL_CONTENT_URI.toString())) {
                        checkMediaStoreForScreenshot();
                    }
                }
            };
            activity.getContentResolver().registerContentObserver(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                true,
                screenshotObserver
            );
        } catch (Exception e) {
            // Permission or OEM restriction
        }
    }

    private void checkMediaStoreForScreenshot() {
        final Activity activity = getActivity();
        if (activity == null) return;

        try {
            String[] projection = new String[]{
                MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.DATE_ADDED
            };
            String sortOrder = MediaStore.Images.Media.DATE_ADDED + " DESC";

            Cursor cursor = activity.getContentResolver().query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                projection,
                null,
                null,
                sortOrder
            );

            if (cursor != null) {
                if (cursor.moveToFirst()) {
                    int nameColumn = cursor.getColumnIndex(MediaStore.Images.Media.DISPLAY_NAME);
                    int dateColumn = cursor.getColumnIndex(MediaStore.Images.Media.DATE_ADDED);

                    String fileName = nameColumn != -1 ? cursor.getString(nameColumn) : "";
                    long dateAdded = dateColumn != -1 ? cursor.getLong(dateColumn) : 0;
                    long currentTimeSec = System.currentTimeMillis() / 1000;

                    if (fileName != null && fileName.toLowerCase().contains("screenshot") && (currentTimeSec - dateAdded) < 10) {
                        notifyCaptureAttempt("POSSIBLE_SCREENSHOT_HEURISTIC");
                    }
                }
                cursor.close();
            }
        } catch (Exception e) {
            // Ignore failure on restricted storage
        }
    }

    private void notifyCaptureAttempt(String method) {
        long now = System.currentTimeMillis();
        // Debounce notifications within 3 seconds
        if (now - lastDetectionTime < 3000) return;
        lastDetectionTime = now;

        JSObject eventData = new JSObject();
        eventData.put("detectionMethod", method);
        eventData.put("timestamp", new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).format(new java.util.Date()));
        notifyListeners("onScreenshotAttempt", eventData);
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        final Activity activity = getActivity();
        if (activity != null) {
            if (Build.VERSION.SDK_INT >= 34 && screenCaptureCallback != null) {
                try {
                    activity.unregisterScreenCaptureCallback((Activity.ScreenCaptureCallback) screenCaptureCallback);
                } catch (Exception e) {}
            }
            if (screenshotObserver != null) {
                try {
                    activity.getContentResolver().unregisterContentObserver(screenshotObserver);
                } catch (Exception e) {}
            }
        }
    }
}
