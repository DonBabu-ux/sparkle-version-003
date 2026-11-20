package com.sparkleapp;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.webkit.PermissionRequest;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * SparkleWebChromeClient
 * Ensures WebRTC microphone and camera requests inside the Capacitor WebView are
 * granted reliably without timing out or failing due to unhandled normal permissions.
 */
public class SparkleWebChromeClient extends BridgeWebChromeClient {

    private final Activity activity;

    public SparkleWebChromeClient(Bridge bridge, Activity activity) {
        super(bridge);
        this.activity = activity;
    }

    @Override
    public void onPermissionRequest(final PermissionRequest request) {
        if (request == null) return;

        activity.runOnUiThread(() -> {
            try {
                List<String> resources = Arrays.asList(request.getResources());
                List<String> grantedResources = new ArrayList<>();
                List<String> permissionsToRequest = new ArrayList<>();

                boolean needsAudio = resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE);
                boolean needsVideo = resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE);

                if (needsAudio) {
                    if (ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        grantedResources.add(PermissionRequest.RESOURCE_AUDIO_CAPTURE);
                    } else {
                        permissionsToRequest.add(Manifest.permission.RECORD_AUDIO);
                    }
                }

                if (needsVideo) {
                    if (ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        grantedResources.add(PermissionRequest.RESOURCE_VIDEO_CAPTURE);
                    } else {
                        permissionsToRequest.add(Manifest.permission.CAMERA);
                    }
                }

                // If all requested resources already have Android runtime permission granted:
                if (permissionsToRequest.isEmpty()) {
                    if (!grantedResources.isEmpty()) {
                        request.grant(grantedResources.toArray(new String[0]));
                    } else {
                        request.deny();
                    }
                    return;
                }

                // Otherwise request missing permissions from the system
                if (activity instanceof MainActivity) {
                    ((MainActivity) activity).requestMediaPermissionsFromWeb(
                        permissionsToRequest.toArray(new String[0]),
                        () -> {
                            activity.runOnUiThread(() -> {
                                try {
                                    List<String> finalGranted = new ArrayList<>();
                                    if (needsAudio && ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                                        finalGranted.add(PermissionRequest.RESOURCE_AUDIO_CAPTURE);
                                    }
                                    if (needsVideo && ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                                        finalGranted.add(PermissionRequest.RESOURCE_VIDEO_CAPTURE);
                                    }

                                    if (!finalGranted.isEmpty()) {
                                        request.grant(finalGranted.toArray(new String[0]));
                                    } else {
                                        request.deny();
                                    }
                                } catch (Exception e) {
                                    request.deny();
                                }
                            });
                        }
                    );
                } else {
                    super.onPermissionRequest(request);
                }
            } catch (Exception e) {
                try {
                    request.deny();
                } catch (Exception ignored) {}
            }
        });
    }
}
