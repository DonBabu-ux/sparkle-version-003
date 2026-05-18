import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sparkleapp',
  appName: 'Sparkle',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    // ── Edge-to-Edge Camera ────────────────────────────────────────────────
    // overlaysWebView: true  → the WebView extends behind the status bar so
    // the camera preview fills the entire screen (Instagram / Snapchat style).
    // backgroundColor must be transparent so the camera shows through.
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#00000000'
    },

    // ── No white splash flash ──────────────────────────────────────────────
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#000000',
      showSpinner: false
    },

    // ── Local file access for gallery ─────────────────────────────────────
    // Allows Filesystem.readFile() to access DCIM / Pictures without a
    // content-scheme redirect that breaks Capacitor's convertFileSrc().
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
