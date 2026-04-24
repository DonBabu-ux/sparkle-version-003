import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sparkle.app',
  appName: 'Sparkle',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
