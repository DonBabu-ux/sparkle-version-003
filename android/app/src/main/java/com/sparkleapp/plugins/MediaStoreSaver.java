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

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Saves base64-encoded media into the user's public Downloads collection.
 * Uses MediaStore on API 29+ (scoped storage, no permission needed) and the
 * legacy public-directory path on older devices.
 *
 * Two hardening changes over the original version:
 *  1. Payloads are decoded and written in ~1 MB chunks (see splitBase64)
 *     instead of Base64.decode(wholeString) + os.write(wholeArray). A long
 *     video used to hold the base64 String, a full byte[] copy and the write
 *     buffer in memory at once — an OOM on big reels. Chunking keeps only one
 *     chunk alive at a time.
 *  2. Failures roll back: a pending MediaStore row is deleted and streams are
 *     closed in try-with-resources. The old code leaked the OutputStream on
 *     write failure and left a 0-byte "pending" ghost in Downloads that only
 *     cleared on reboot.
 */
@CapacitorPlugin(name = "MediaStoreSaver")
public class MediaStoreSaver extends Plugin {

    /** Source characters per decoded chunk — must stay a multiple of 4.
        Package-private so a unit test guards that invariant. */
    static final int PRODUCTION_CHUNK_CHARS = 1 << 20;

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String data = call.getString("data");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String fileName = call.getString("fileName");

        if (data == null || data.isEmpty() || fileName == null || fileName.isEmpty()) {
            call.reject("Missing data or fileName");
            return;
        }

        List<String> chunks = splitBase64(data);
        if (chunks.isEmpty()) {
            call.reject("Payload is not valid base64");
            return;
        }

        try {
            String savedPath;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                savedPath = saveViaMediaStore(call, chunks, fileName, mimeType);
            } else {
                savedPath = saveViaLegacyFile(call, chunks, fileName);
            }
            JSObject ret = new JSObject();
            ret.put("path", savedPath);
            ret.put("fileName", fileName);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Save failed: " + e.getMessage(), e);
        }
    }

    /** API 29+ path. */
    private String saveViaMediaStore(PluginCall call, List<String> chunks,
                                     String fileName, String mimeType) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
        values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
        values.put(MediaStore.Downloads.IS_PENDING, 1);

        Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) {
            throw new IllegalStateException("could not create download entry");
        }

        try (OutputStream raw = resolver.openOutputStream(uri)) {
            if (raw == null) {
                // Nothing opened — delete the row so Downloads shows no ghost.
                resolver.delete(uri, null, null);
                throw new IllegalStateException("could not open output stream");
            }
            try (BufferedOutputStream out = new BufferedOutputStream(raw)) {
                for (String chunk : chunks) {
                    out.write(Base64.decode(chunk, Base64.DEFAULT));
                }
                out.flush();
            }
        } catch (Exception e) {
            // Roll the pending row back; a half-written "pending" item survives
            // reboots otherwise.
            try {
                resolver.delete(uri, null, null);
            } catch (Exception ignored) {
            }
            throw e;
        }

        ContentValues done = new ContentValues();
        done.put(MediaStore.Downloads.IS_PENDING, 0);
        resolver.update(uri, done, null, null);
        return uri.toString();
    }

    /** API 28- legacy path (needs WRITE_EXTERNAL_STORAGE, granted via manifest maxSdk 28). */
    private String saveViaLegacyFile(PluginCall call, List<String> chunks, String fileName) throws Exception {
        File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("downloads directory unavailable");
        }
        File out = new File(dir, fileName);
        try (FileOutputStream fos = new FileOutputStream(out);
             BufferedOutputStream bos = new BufferedOutputStream(fos)) {
            for (String chunk : chunks) {
                bos.write(Base64.decode(chunk, Base64.DEFAULT));
            }
            bos.flush();
        } catch (Exception e) {
            if (out.exists() && !out.delete()) {
                // Best effort; a partial file is better than a delete loop.
                out.deleteOnExit();
            }
            throw e;
        }
        return out.getAbsolutePath();
    }

    /**
     * Splits base64 into ~1 MB pieces, each a whole number of 4-character
     * quanta with '=' padding kept only on the final chunk, so
     * Base64.decode(chunk, DEFAULT) never crosses a bad boundary. Whitespace
     * and newlines (data URLs, transports that wrap at 76 columns) are stripped
     * first — Base64.DEFAULT does not define newline tolerance, so a wrapped
     * payload would otherwise fail on one device shape and pass on another.
     *
     * Package-private on purpose: unit-tested directly in
     * MediaStoreSaverSplitTest.
     */
    static List<String> splitBase64(String base64) {
        return splitBase64(base64, PRODUCTION_CHUNK_CHARS);
    }

    /** Same split with an explicit chunk size (must be a multiple of 4) — used
     *  by the unit tests to hit the multi-chunk boundaries without having to
     *  build megabyte-sized fixtures. */
    static List<String> splitBase64(String base64, int chunkChars) {
        List<String> chunks = new ArrayList<>();
        if (base64 == null) return chunks;

        StringBuilder clean = new StringBuilder(base64.length());
        for (int i = 0; i < base64.length(); i++) {
            char c = base64.charAt(i);
            if (c != '\n' && c != '\r' && c != '\t' && c != ' ') {
                clean.append(c);
            }
        }
        String s = clean.toString();
        if (s.isEmpty()) return chunks;

        // Separate the padding so chunk boundaries always land on quanta.
        int coreEnd = s.length();
        while (coreEnd > 0 && s.charAt(coreEnd - 1) == '=') {
            coreEnd--;
        }
        String core = s.substring(0, coreEnd);
        String padding = s.substring(coreEnd);

        int start = 0;
        while (start < core.length()) {
            int end = Math.min(start + chunkChars, core.length());
            String chunk = core.substring(start, end);
            if (end >= core.length() && !padding.isEmpty()) {
                chunk = chunk + padding;
            }
            chunks.add(chunk);
            start = end;
        }
        if (chunks.isEmpty() && !padding.isEmpty()) {
            chunks.add(padding);
        }
        return chunks;
    }
}