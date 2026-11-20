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

import androidx.core.app.ActivityCompat;
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
        @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "bluetooth")
    }
)
public class CallPermissionsPlugin extends Plugin {

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
