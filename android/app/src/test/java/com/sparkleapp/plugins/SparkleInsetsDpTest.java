package com.sparkleapp.plugins;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

/**
 * The px→dp conversion every safe-area CSS variable depends on. A regression
 * here silently mis-positions the whole UI on the notch/nav-bar.
 */
public class SparkleInsetsDpTest {

    @Test
    public void convertsPixelsToDp() {
        assertEquals(96.0, SparkleInsetsPlugin.dp(192, 2f), 0.001);
        assertEquals(75.0, SparkleInsetsPlugin.dp(150, 2f), 0.001);
        assertEquals(160.0, SparkleInsetsPlugin.dp(480, 3f), 0.001);
    }

    @Test
    public void roundsToTwoDecimals() {
        // 100 / 2.75 = 36.3636… → 36.36
        assertEquals(36.36, SparkleInsetsPlugin.dp(100, 2.75f), 0.001);
    }

    @Test
    public void zeroAndInvalidDensityNeverCrash() {
        assertEquals(0.0, SparkleInsetsPlugin.dp(0, 1f), 0.001);
        assertEquals(0.0, SparkleInsetsPlugin.dp(480, 0f), 0.001);
        assertEquals(0.0, SparkleInsetsPlugin.dp(480, -1f), 0.001);
    }

    @Test
    public void handlesTabletAndWatchDensities() {
        // TV / tablet densities are where the old integer math lost 1-2dp.
        assertEquals(96.0, SparkleInsetsPlugin.dp(480, 5f), 0.001);
        assertEquals(160.0, SparkleInsetsPlugin.dp(1600, 10f), 0.001);
    }
}