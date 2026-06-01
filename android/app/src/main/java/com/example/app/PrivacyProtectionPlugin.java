package com.example.app;

import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.gson.Gson;
@CapacitorPlugin(name = "PrivacyProtection")
public class PrivacyProtectionPlugin extends Plugin {

    @PluginMethod
    public void enablePrivacyProtection(PluginCall call) {
        getBridge().getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    getBridge().getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
                    JSObject ret = new JSObject();
                    ret.put("enabled", true);
                    call.resolve(ret);
                } catch (Exception e) {
                    call.reject("Failed to enable FLAG_SECURE: " + e.getMessage());
                }
            }
        });
    }

    @PluginMethod
    public void disablePrivacyProtection(PluginCall call) {
        getBridge().getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    getBridge().getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                    JSObject ret = new JSObject();
                    ret.put("enabled", false);
                    call.resolve(ret);
                } catch (Exception e) {
                    call.reject("Failed to clear FLAG_SECURE: " + e.getMessage());
                }
            }
        });
    }

    @PluginMethod
    public void setPrivacyForChat(PluginCall call) {
        String chatId = call.getString("chatId");
        if (chatId == null) {
            call.reject("chatId is required");
            return;
        }
        // Perform network request on background thread
        new Thread(() -> {
            try {
                // Replace with actual base URL or retrieve from config
                String url = "https://sparkle-version-003-1-f4v3.onrender.com/api/chats/" + chatId + "/privacy";
                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                conn.setRequestMethod("GET");
                // TODO: add proper Authorization header if needed
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                int responseCode = conn.getResponseCode();
                if (responseCode == 200) {
                    java.io.InputStream is = conn.getInputStream();
                    java.util.Scanner s = new java.util.Scanner(is).useDelimiter("\\A");
                    String response = s.hasNext() ? s.next() : "";
                    boolean protect = response.contains("\"screenshotProtection\":true");
                    // Apply or clear FLAG_SECURE on UI thread
                    getBridge().getActivity().runOnUiThread(() -> {
                        if (protect) {
                            getBridge().getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
                        } else {
                            getBridge().getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                        }
                    });
                    JSObject result = new JSObject();
                    result.put("applied", true);
                    call.resolve(result);
                } else {
                    call.reject("Failed to fetch privacy settings, code: " + responseCode);
                }
            } catch (Exception e) {
                call.reject("Error fetching privacy settings: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void reportCaptureAttempt(PluginCall call) {
        String chatId = call.getString("chatId");
        String attemptType = call.getString("attemptType");
        String detectionMethod = call.getString("detectionMethod");
        com.getcapacitor.JSObject deviceInfo = call.getObject("deviceInfo");
        com.getcapacitor.JSObject metadata = call.getObject("metadata");
        if (chatId == null || attemptType == null) {
            call.reject("chatId and attemptType are required");
            return;
        }
        new Thread(() -> {
            try {
                String url = "https://sparkle-version-003-1-f4v3.onrender.com/api/chats/" + chatId + "/capture-attempt";
                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                java.util.Map<String, Object> payload = new java.util.HashMap<>();
                payload.put("attemptType", attemptType);
                payload.put("detectionMethod", detectionMethod);
                payload.put("deviceInfo", deviceInfo != null ? deviceInfo.toString() : null);
                payload.put("metadata", metadata != null ? metadata.toString() : null);
                // Use Gson for JSON serialization (ensure dependency available)
                com.google.gson.Gson gson = new com.google.gson.Gson();
                String json = gson.toJson(payload);
                try (java.io.OutputStream os = conn.getOutputStream()) {
                    byte[] input = json.getBytes("utf-8");
                    os.write(input, 0, input.length);
                }
                int responseCode = conn.getResponseCode();
                if (responseCode == 200 || responseCode == 201) {
                    call.resolve(new com.getcapacitor.JSObject().put("reported", true));
                } else {
                    call.reject("Failed to report capture attempt, code: " + responseCode);
                }
            } catch (Exception e) {
                call.reject("Error reporting capture attempt: " + e.getMessage());
            }
        }).start();
    }
    }
}
