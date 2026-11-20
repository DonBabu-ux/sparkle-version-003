package com.sparkleapp.plugins;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import org.json.JSONArray;
import org.json.JSONObject;

import android.content.SharedPreferences;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "CallPermissions",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone"),
        @Permission(strings = { Manifest.permission.CAMERA }, alias = "camera"),
        @Permission(strings = { Manifest.permission.MODIFY_AUDIO_SETTINGS }, alias = "audio_settings"),
        @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "bluetooth"),
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications"),
        @Permission(strings = { Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO }, alias = "media"),
        @Permission(strings = { Manifest.permission.READ_EXTERNAL_STORAGE }, alias = "media_legacy"),
        @Permission(strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }, alias = "location"),
        @Permission(strings = { Manifest.permission.READ_CONTACTS }, alias = "contacts")
    }
)
public class CallPermissionsPlugin extends Plugin {

    private static final String PREFS_NAME = "sparkle_permission_prefs";

    private SharedPreferences getPrefs() {
        Activity activity = getActivity();
        return activity != null ? activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE) : null;
    }

    private boolean hasRequestedPermission(String name) {
        SharedPreferences prefs = getPrefs();
        return prefs != null && prefs.getBoolean("req_" + name, false);
    }

    private void markPermissionRequested(String name) {
        SharedPreferences prefs = getPrefs();
        if (prefs != null) {
            prefs.edit().putBoolean("req_" + name, true).apply();
        }
    }

    private String evaluateStandardPermission(Activity activity, String permission, String name) {
        if (activity == null) return "unavailable";
        if (ContextCompat.checkSelfPermission(activity, permission) == PackageManager.PERMISSION_GRANTED) {
            return "granted";
        }
        if (!hasRequestedPermission(name)) {
            return "prompt";
        }
        if (ActivityCompat.shouldShowRequestPermissionRationale(activity, permission)) {
            return "denied";
        }
        return "permanently_denied";
    }

    private String getCameraStatus(Activity activity) {
        return evaluateStandardPermission(activity, Manifest.permission.CAMERA, "camera");
    }

    private String getMicrophoneStatus(Activity activity) {
        return evaluateStandardPermission(activity, Manifest.permission.RECORD_AUDIO, "microphone");
    }

    private String getNotificationsStatus(Activity activity) {
        if (activity == null) return "unavailable";
        NotificationManagerCompat nmc = NotificationManagerCompat.from(activity);
        if (!nmc.areNotificationsEnabled()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (!hasRequestedPermission("notifications")) return "prompt";
                if (ActivityCompat.shouldShowRequestPermissionRationale(activity, Manifest.permission.POST_NOTIFICATIONS)) {
                    return "denied";
                }
                return "permanently_denied";
            }
            return "denied";
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
                return "granted";
            }
            if (!hasRequestedPermission("notifications")) return "prompt";
            if (ActivityCompat.shouldShowRequestPermissionRationale(activity, Manifest.permission.POST_NOTIFICATIONS)) {
                return "denied";
            }
            return "permanently_denied";
        }
        return "granted";
    }

    private String getMediaStatus(Activity activity) {
        if (activity == null) return "unavailable";

        if (Build.VERSION.SDK_INT >= 34) { // Android 14+
            boolean hasImages = ContextCompat.checkSelfPermission(activity, Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED;
            boolean hasVideo = ContextCompat.checkSelfPermission(activity, Manifest.permission.READ_MEDIA_VIDEO) == PackageManager.PERMISSION_GRANTED;
            if (hasImages && hasVideo) return "granted";

            // Check limited access
            boolean hasSelected = ContextCompat.checkSelfPermission(activity, "android.permission.READ_MEDIA_VISUAL_USER_SELECTED") == PackageManager.PERMISSION_GRANTED;
            if (hasSelected) return "limited";

            if (!hasRequestedPermission("media")) return "prompt";
            if (ActivityCompat.shouldShowRequestPermissionRationale(activity, Manifest.permission.READ_MEDIA_IMAGES)) {
                return "denied";
            }
            return "permanently_denied";
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) { // Android 13
            boolean hasImages = ContextCompat.checkSelfPermission(activity, Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED;
            boolean hasVideo = ContextCompat.checkSelfPermission(activity, Manifest.permission.READ_MEDIA_VIDEO) == PackageManager.PERMISSION_GRANTED;
            if (hasImages && hasVideo) return "granted";

            if (!hasRequestedPermission("media")) return "prompt";
            if (ActivityCompat.shouldShowRequestPermissionRationale(activity, Manifest.permission.READ_MEDIA_IMAGES)) {
                return "denied";
            }
            return "permanently_denied";
        } else { // Android 12 and below
            return evaluateStandardPermission(activity, Manifest.permission.READ_EXTERNAL_STORAGE, "media");
        }
    }

    private String getLocationStatus(Activity activity) {
        if (activity == null) return "unavailable";
        boolean hasFine = ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean hasCoarse = ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        if (hasFine || hasCoarse) return "granted";

        if (!hasRequestedPermission("location")) return "prompt";
        if (ActivityCompat.shouldShowRequestPermissionRationale(activity, Manifest.permission.ACCESS_FINE_LOCATION)) {
            return "denied";
        }
        return "permanently_denied";
    }

    private String getContactsStatus(Activity activity) {
        return evaluateStandardPermission(activity, Manifest.permission.READ_CONTACTS, "contacts");
    }

    private String getBluetoothStatus(Activity activity) {
        if (activity == null) return "unavailable";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return evaluateStandardPermission(activity, Manifest.permission.BLUETOOTH_CONNECT, "bluetooth");
        }
        return "granted";
    }

    @PluginMethod
    public void checkAllPermissions(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        JSObject ret = new JSObject();
        ret.put("camera", getCameraStatus(activity));
        ret.put("microphone", getMicrophoneStatus(activity));
        ret.put("notifications", getNotificationsStatus(activity));
        ret.put("media", getMediaStatus(activity));
        ret.put("location", getLocationStatus(activity));
        ret.put("contacts", getContactsStatus(activity));
        ret.put("bluetooth", getBluetoothStatus(activity));
        call.resolve(ret);
    }

    @PluginMethod
    public void requestSinglePermission(PluginCall call) {
        String name = call.getString("name", "");
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        markPermissionRequested(name);

        if ("camera".equalsIgnoreCase(name)) {
            requestPermissionForAliases(new String[]{ "camera" }, call, "singlePermissionCallback");
        } else if ("microphone".equalsIgnoreCase(name)) {
            requestPermissionForAliases(new String[]{ "microphone" }, call, "singlePermissionCallback");
        } else if ("notifications".equalsIgnoreCase(name)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                requestPermissionForAliases(new String[]{ "notifications" }, call, "singlePermissionCallback");
            } else {
                JSObject ret = new JSObject();
                ret.put("name", name);
                ret.put("status", getNotificationsStatus(activity));
                call.resolve(ret);
            }
        } else if ("media".equalsIgnoreCase(name)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                requestPermissionForAliases(new String[]{ "media" }, call, "singlePermissionCallback");
            } else {
                requestPermissionForAliases(new String[]{ "media_legacy" }, call, "singlePermissionCallback");
            }
        } else if ("location".equalsIgnoreCase(name)) {
            requestPermissionForAliases(new String[]{ "location" }, call, "singlePermissionCallback");
        } else if ("contacts".equalsIgnoreCase(name)) {
            requestPermissionForAliases(new String[]{ "contacts" }, call, "singlePermissionCallback");
        } else if ("bluetooth".equalsIgnoreCase(name)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                requestPermissionForAliases(new String[]{ "bluetooth" }, call, "singlePermissionCallback");
            } else {
                JSObject ret = new JSObject();
                ret.put("name", name);
                ret.put("status", "granted");
                call.resolve(ret);
            }
        } else {
            call.reject("Unknown permission: " + name);
        }
    }

    @PermissionCallback
    private void singlePermissionCallback(PluginCall call) {
        Activity activity = getActivity();
        String name = call.getString("name", "");
        String status = "denied";

        if (activity != null) {
            if ("camera".equalsIgnoreCase(name)) {
                status = getCameraStatus(activity);
            } else if ("microphone".equalsIgnoreCase(name)) {
                status = getMicrophoneStatus(activity);
            } else if ("notifications".equalsIgnoreCase(name)) {
                status = getNotificationsStatus(activity);
            } else if ("media".equalsIgnoreCase(name)) {
                status = getMediaStatus(activity);
            } else if ("location".equalsIgnoreCase(name)) {
                status = getLocationStatus(activity);
            } else if ("contacts".equalsIgnoreCase(name)) {
                status = getContactsStatus(activity);
            } else if ("bluetooth".equalsIgnoreCase(name)) {
                status = getBluetoothStatus(activity);
            }
        }

        JSObject ret = new JSObject();
        ret.put("name", name);
        ret.put("status", status);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkCallPermissions(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        boolean hasMic = ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
        boolean hasCamera = ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;

        String micState = hasMic ? "granted" : (ActivityCompat.shouldShowRequestPermissionRationale(activity, Manifest.permission.RECORD_AUDIO) ? "prompt" : "prompt");
        String cameraState = hasCamera ? "granted" : (ActivityCompat.shouldShowRequestPermissionRationale(activity, Manifest.permission.CAMERA) ? "prompt" : "prompt");

        JSObject ret = new JSObject();
        ret.put("microphone", micState);
        ret.put("camera", cameraState);
        ret.put("hasMicrophone", hasMic);
        ret.put("hasCamera", hasCamera);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestCallPermissions(PluginCall call) {
        String mode = call.getString("mode", "voice");
        if ("video".equalsIgnoreCase(mode)) {
            requestPermissionForAliases(new String[]{ "microphone", "camera" }, call, "permissionsCallback");
        } else {
            requestPermissionForAliases(new String[]{ "microphone" }, call, "permissionsCallback");
        }
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        boolean hasMic = ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
        boolean hasCamera = ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;

        JSObject ret = new JSObject();
        ret.put("microphone", hasMic ? "granted" : "denied");
        ret.put("camera", hasCamera ? "granted" : "denied");
        ret.put("hasMicrophone", hasMic);
        ret.put("hasCamera", hasCamera);
        call.resolve(ret);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            Uri uri = Uri.fromParts("package", activity.getPackageName(), null);
            intent.setData(uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open app settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        try {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, activity.getPackageName());
            } else {
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                Uri uri = Uri.fromParts("package", activity.getPackageName(), null);
                intent.setData(uri);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                Uri uri = Uri.fromParts("package", activity.getPackageName(), null);
                fallback.setData(uri);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(fallback);
                call.resolve();
            } catch (Exception ex) {
                call.reject("Could not open notification settings: " + ex.getMessage());
            }
        }
    }

    @PluginMethod
    public void requestBluetoothPermission(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        requestPermissionForAliases(new String[]{ "bluetooth" }, call, "bluetoothPermissionCallback");
    }

    @PermissionCallback
    private void bluetoothPermissionCallback(PluginCall call) {
        Activity activity = getActivity();
        JSObject ret = new JSObject();
        ret.put(
            "granted",
            activity != null && ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
        );
        call.resolve(ret);
    }

    @PluginMethod
    public void getAudioDevices(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }
        AudioManager audioManager = (AudioManager) activity.getSystemService(Context.AUDIO_SERVICE);
        if (audioManager == null) {
            call.reject("AudioManager unavailable");
            return;
        }
        JSONArray devices = new JSONArray();
        for (AudioDeviceInfo device : audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
            String type = "unknown";
            if (device.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) type = "speaker";
            else if (device.getType() == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) type = "earpiece";
            else if (device.getType() == AudioDeviceInfo.TYPE_BLUETOOTH_SCO || device.getType() == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP) type = "bluetooth";
            else if (device.getType() == AudioDeviceInfo.TYPE_WIRED_HEADSET || device.getType() == AudioDeviceInfo.TYPE_WIRED_HEADPHONES || device.getType() == AudioDeviceInfo.TYPE_USB_HEADSET) type = "headphones";
            try {
                JSONObject item = new JSONObject();
                item.put("deviceId", String.valueOf(device.getId()));
                item.put("label", device.getProductName() != null ? device.getProductName().toString() : type);
                item.put("type", type);
                devices.put(item);
            } catch (Exception ignored) {}
        }
        JSObject ret = new JSObject();
        ret.put("devices", devices);
        call.resolve(ret);
    }

    @PluginMethod
    public void setAudioRoute(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        String route = call.getString("route", "speaker");
        String deviceId = call.getString("deviceId", null);
        try {
            AudioManager audioManager = (AudioManager) activity.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager == null) {
                call.reject("AudioManager unavailable");
                return;
            }

            if ("bluetooth".equalsIgnoreCase(route) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                    && ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                call.reject("Bluetooth permission is required");
                return;
            }

            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);

            if ("speaker".equalsIgnoreCase(route)) {
                audioManager.stopBluetoothSco();
                audioManager.setBluetoothScoOn(false);
                audioManager.setSpeakerphoneOn(true);
                selectCommunicationDevice(audioManager, AudioDeviceInfo.TYPE_BUILTIN_SPEAKER, null);
            } else if ("earpiece".equalsIgnoreCase(route)) {
                audioManager.stopBluetoothSco();
                audioManager.setBluetoothScoOn(false);
                audioManager.setSpeakerphoneOn(false);
                selectCommunicationDevice(audioManager, AudioDeviceInfo.TYPE_BUILTIN_EARPIECE, null);
            } else if ("headphones".equalsIgnoreCase(route)) {
                audioManager.stopBluetoothSco();
                audioManager.setBluetoothScoOn(false);
                audioManager.setSpeakerphoneOn(false);
                selectCommunicationDevice(audioManager, AudioDeviceInfo.TYPE_WIRED_HEADSET, deviceId);
            } else if ("bluetooth".equalsIgnoreCase(route)) {
                audioManager.setSpeakerphoneOn(false);
                selectCommunicationDevice(audioManager, AudioDeviceInfo.TYPE_BLUETOOTH_SCO, deviceId);
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
                    audioManager.startBluetoothSco();
                    audioManager.setBluetoothScoOn(true);
                }
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("route", route);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to set audio route: " + e.getMessage());
        }
    }

    private void selectCommunicationDevice(AudioManager audioManager, int deviceType, String deviceId) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return;
        for (AudioDeviceInfo device : audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
            boolean matchesId = deviceId != null && String.valueOf(device.getId()).equals(deviceId);
            boolean matchesType = deviceId == null && device.getType() == deviceType;
            if (matchesId || matchesType) {
                audioManager.setCommunicationDevice(device);
                return;
            }
        }
    }

    @PluginMethod
    public void resetAudioRoute(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }

        try {
            AudioManager audioManager = (AudioManager) activity.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                audioManager.stopBluetoothSco();
                audioManager.setBluetoothScoOn(false);
                audioManager.setSpeakerphoneOn(false);
                audioManager.setMode(AudioManager.MODE_NORMAL);
            }
        } catch (Exception ignored) {}
        call.resolve();
    }
}
