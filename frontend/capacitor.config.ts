import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sparkleapp',
  appName: 'Sparkle',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
