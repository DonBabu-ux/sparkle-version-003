package com.sparkleapp.plugins;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

import java.util.List;

/**
 * The chunked base64 splitter: it protects large reel/video downloads from the
 * OOM the old whole-array path caused, so the invariants that keep
 * Base64.decode() correct per-chunk are worth pinning down.
 *
 * Robolectric because one test round-trips through android.util.Base64 — an
 * android.jar stub under plain unit tests.
 */
@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 34)
public class MediaStoreSaverSplitTest {

    @Test
    public void smallPayloadIsOneChunk() {
        List<String> chunks = MediaStoreSaver.splitBase64("QUJD"); // "ABC"
        assertEquals(1, chunks.size());
        assertEquals("QUJD", chunks.get(0));
    }

    @Test
    public void everyChunkIsAFourCharQuantumMultiple() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 100_000; i++) {
            sb.append("QUJD");
        }
        // Injected chunk size of 8 source chars → thousands of chunks, which
        // is what the boundary invariants are actually about (the production
        // chunk size is 1 MB and would swallow this fixture whole).
        List<String> chunks = MediaStoreSaver.splitBase64(sb.toString(), 8);
        assertTrue(chunks.size() > 1);
        for (int i = 0; i < chunks.size(); i++) {
            String chunk = chunks.get(i);
            boolean isLast = i == chunks.size() - 1;
            if (!isLast) {
                // only the final chunk may carry padding
                assertEquals(0, chunk.length() % 4);
            }
        }
    }

    @Test
    public void paddingOnlyEverLandsOnTheFinalChunk() {
        // A real encoded payload: length ≡ 1 (mod 3) so it ends in "==", and
        // valid base64 carries padding only at the very end — which is the
        // shape MediaStoreSaver actually receives. (The earlier fixture here
        // repeated "YQ==" N times, which is not a valid single payload and put
        // '=' in the middle, so the assertion was wrong by construction.)
        byte[] payload = new byte[600_001];
        for (int i = 0; i < payload.length; i++) {
            payload[i] = (byte) (i % 251);
        }
        String base64 = android.util.Base64.encodeToString(payload, android.util.Base64.NO_WRAP);
        assertEquals(2, countChar(base64, '='));

        List<String> chunks = MediaStoreSaver.splitBase64(base64, 16);
        assertTrue(chunks.size() > 1);
        for (int i = 0; i < chunks.size(); i++) {
            boolean hasPadding = chunks.get(i).indexOf('=') >= 0;
            assertEquals("chunk " + i + " of " + chunks.size(),
                    i == chunks.size() - 1, hasPadding);
        }
    }

    private static int countChar(String s, char c) {
        int n = 0;
        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) == c) n++;
        }
        return n;
    }

    @Test
    public void productionChunkSizeIsAMultipleOfFour() {
        // Guards the constant itself: a future bump to a non-multiple would
        // silently corrupt every payload by splitting mid-quantum.
        assertEquals(0, MediaStoreSaver.PRODUCTION_CHUNK_CHARS % 4);
    }

    @Test
    public void whitespaceAndNewlinesAreStripped() {
        // Transports that wrap base64 at 76 columns must still decode.
        String wrapped = "QUJD\r\nQUJD QUJD\tQUJD\n";
        List<String> chunks = MediaStoreSaver.splitBase64(wrapped);
        assertEquals(1, chunks.size());
        assertEquals("QUJDQUJDQUJDQUJD", chunks.get(0));
    }

    @Test
    public void emptiesAndNullProduceNoChunks() {
        assertTrue(MediaStoreSaver.splitBase64(null).isEmpty());
        assertTrue(MediaStoreSaver.splitBase64("").isEmpty());
        assertTrue(MediaStoreSaver.splitBase64("   \n\t ").isEmpty());
    }

    @Test
    public void roundTripDecodesToTheSameBytes() {
        byte[] original = new byte[5_000];
        for (int i = 0; i < original.length; i++) {
            original[i] = (byte) (i % 251);
        }
        String base64 = android.util.Base64.encodeToString(original, android.util.Base64.DEFAULT);
        List<String> chunks = MediaStoreSaver.splitBase64(base64);

        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        for (String chunk : chunks) {
            byte[] decoded = android.util.Base64.decode(chunk, android.util.Base64.DEFAULT);
            out.write(decoded, 0, decoded.length);
        }
        assertFalse(android.util.Base64.encodeToString(out.toByteArray(), android.util.Base64.NO_WRAP)
                .isEmpty());
        assertEquals(original.length, out.toByteArray().length);
        for (int i = 0; i < original.length; i++) {
            assertEquals(original[i], out.toByteArray()[i]);
        }
    }
}