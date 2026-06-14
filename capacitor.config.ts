import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.veetaa.app',
  appName: 'Veetaa',
  webDir: 'dist',
  server: {
    // L'APK embarque les fichiers web compilés (dist/) directement
    // Les appels API vont vers Supabase en production
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#0f172a',
  },
};

export default config;
