package com.sparkleapp.plugins;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import com.getcapacitor.JSObject;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

/**
 * The call state snapshot JS reads via SparkleCall.getState(). It must survive
 * the exact failure mode the platform throws at us: a callEvent emitted while
 * the bridge/WebView was cold (background notification action, Android Auto),
 * only for JS to ask "what is happening?" a second later.
 */
@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 34)
public class CallCoordinatorSnapshotTest {

    @Test
    public void startsIdle() {
        JSObject state = CallCoordinator.getSnapshot();
        assertEquals("idle", state.optString("state", "missing"));
        assertFalse(state.optBoolean("video", true));
        assertFalse(state.optBoolean("muted", true));
    }

    @Test
    public void muteIsMirroredIntoTheSnapshot() {
        // WebRTC mute itself is JS-side; the native snapshot exists so system
        // surfaces (Auto/Wear) see the same truth. Only this mapping is under
        // test here — no plugin instance is attached, and that is legal
        // because events are dropped while the bridge is cold.
        CallCoordinator.setMuted(true);
        assertTrue(CallCoordinator.getSnapshot().optBoolean("muted", false));
        CallCoordinator.setMuted(false);
        assertFalse(CallCoordinator.getSnapshot().optBoolean("muted", true));
    }

    @Test
    public void ringTimeoutIsClampedToSaneBounds() {
        int original = CallCoordinator.getRingTimeoutMs();
        CallCoordinator.setRingTimeoutMs(500); // absurdly short
        assertEquals(5_000, CallCoordinator.getRingTimeoutMs());
        CallCoordinator.setRingTimeoutMs(original);
        assertEquals(original, CallCoordinator.getRingTimeoutMs());
    }
}