package com.sparkleapp.plugins;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Saves base64-encoded media into the user's public Downloads collection.
 * Uses MediaStore on API 29+ (scoped storage, no permission needed) and the
 * legacy public-directory path on older devices.
 */
@CapacitorPlugin(name = "MediaStoreSaver")
public class MediaStoreSaver extends Plugin {

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String data = call.getString("data");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String fileName = call.getString("fileName");

        if (data == null || data.isEmpty() || fileName == null || fileName.isEmpty()) {
            call.reject("Missing data or fileName");
            return;
        }

        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            String savedPath;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                values.put(MediaStore.Downloads.IS_PENDING, 1);

                ContentResolver resolver = getContext().getContentResolver();
                Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) {
                    call.reject("Could not create download entry");
                    return;
                }
                OutputStream os = resolver.openOutputStream(uri);
                if (os == null) {
                    call.reject("Could not open output stream");
                    return;
                }
                os.write(bytes);
                os.close();

                values.clear();
                values.put(MediaStore.Downloads.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
                savedPath = uri.toString();
            } else {
                File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!dir.exists() && !dir.mkdirs()) {
                    call.reject("Downloads directory unavailable");
                    return;
                }
                File out = new File(dir, fileName);
                FileOutputStream fos = new FileOutputStream(out);
                fos.write(bytes);
                fos.close();
                savedPath = out.getAbsolutePath();
            }

            JSObject ret = new JSObject();
            ret.put("path", savedPath);
            ret.put("fileName", fileName);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Save failed: " + e.getMessage(), e);
        }
    }
}
