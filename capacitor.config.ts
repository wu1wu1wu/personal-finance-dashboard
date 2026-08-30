import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pfd.ledger',
  appName: '记账',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
