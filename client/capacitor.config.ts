import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for ShiftSync.
 *
 * Native builds (Android Studio / Xcode) load the pre-built web app from the
 * `dist/` directory.  API requests use the VITE_API_BASE_URL environment
 * variable set at build time (see .env.mobile.example).
 *
 * Google OAuth deep-link setup
 * ────────────────────────────
 * After running `npx cap add android` / `npx cap add ios`, register the
 * "shiftsync" URL scheme so the OS hands deep links back to the app:
 *
 *  Android: add to android/app/src/main/AndroidManifest.xml inside the
 *           existing <activity> block (see docs/mobile-setup-guide.md).
 *
 *  iOS:     add "shiftsync" to the CFBundleURLSchemes array in
 *           ios/App/App/Info.plist (see docs/mobile-setup-guide.md).
 *
 * Also add "shiftsync://login" (and "shiftsync://login?*") as an Authorised
 * redirect URI in your Google Cloud Console OAuth credentials.
 */
const config: CapacitorConfig = {
  appId: 'com.shiftsync.app',
  appName: 'ShiftSync',
  // webDir points to the Vite build output relative to this file
  webDir: 'dist',
  plugins: {
    // @capacitor/browser – used for in-app OAuth on native platforms
    Browser: {},
  },
  android: {
    // Allow the WebView to make cleartext (http://) requests during development.
    // In production all traffic should go over HTTPS.
    allowMixedContent: true,
  },
  ios: {
    // Scroll-bounce and status bar styling
    scrollEnabled: true,
  },
};

export default config;
