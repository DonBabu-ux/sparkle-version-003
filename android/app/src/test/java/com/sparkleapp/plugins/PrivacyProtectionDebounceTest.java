package com.sparkleapp.plugins;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/**
 * Screenshot-detection debounce. Wrong here means either a burst of duplicate
 * "screenshot detected" events on every detection, or a silently dropped
 * second one — both are user-visible in the privacy warning UI.
 */
public class PrivacyProtectionDebounceTest {

    private static final long WINDOW = 3_000;

    @Test
    public void firstDetectionAlwaysPasses() {
        // last == 0 (never detected yet) must not be treated as "within window"
        assertFalse(PrivacyProtectionPlugin.withinDebounceWindow(10_000, 0, WINDOW));
    }

    @Test
    public void secondDetectionInsideWindowIsDebounced() {
        assertTrue(PrivacyProtectionPlugin.withinDebounceWindow(10_001, 10_000, WINDOW));
        assertTrue(PrivacyProtectionPlugin.withinDebounceWindow(12_999, 10_000, WINDOW));
    }

    @Test
    public void detectionAfterWindowPasses() {
        assertFalse(PrivacyProtectionPlugin.withinDebounceWindow(13_000, 10_000, WINDOW));
    }

    @Test
    public void boundaryIsExclusive() {
        // "within 3 seconds" — exactly 3000ms elapsed is NOT within
        assertFalse(PrivacyProtectionPlugin.withinDebounceWindow(10_000 + WINDOW, 10_000, WINDOW));
    }

    @Test
    public void clockRunningBackwardsIsDebouncedNotPassed() {
        // NTP steps / device clock changes: now < last must not read as a
        // huge positive delta that would spam events.
        assertTrue(PrivacyProtectionPlugin.withinDebounceWindow(9_000, 10_000, WINDOW));
    }
}