# Building ShiftSync as a Native Mobile App (Android & iOS)

ShiftSync uses [Capacitor](https://capacitorjs.com/) to wrap the React web app as a
native application that can be built with **Android Studio** or **Xcode**.

---

## Prerequisites

| Tool | Version | Required for |
|------|---------|-------------|
| Node.js | ≥ 20 | All builds |
| Android Studio | Flamingo+ | Android builds |
| JDK | 17+ | Android builds |
| macOS + Xcode | 14+ | iOS builds (macOS only) |
| CocoaPods | 1.12+ | iOS builds |

> **iOS note:** Apple requires a Mac running macOS and Xcode. iOS builds cannot
> be produced on Windows or Linux.

---

## Quick Start

### 1 — Configure the mobile environment

```bash
cd client
cp .env.mobile.example .env.mobile
```

Open `.env.mobile` and set `VITE_API_BASE_URL` to your deployed ShiftSync server:

```env
VITE_API_BASE_URL=https://your-shiftsync-server.onrender.com
```

This tells the native app where to send API requests.

---

### 2 — Build and open in Android Studio

```bash
cd client
npm run cap:android
```

This command:
1. Compiles TypeScript and bundles the React app (with `VITE_API_BASE_URL` embedded).
2. Runs `npx cap sync` to copy web assets into the `android/` project.
3. Opens Android Studio.

In Android Studio, select **Run → Run 'app'** (or press **▶**) to deploy to a
connected device or emulator.

---

### 3 — Build and open in Xcode (macOS only)

```bash
cd client
npm run cap:ios
```

In Xcode:
1. Select your signing team under **Signing & Capabilities**.
2. Pick a simulator or connected device.
3. Press **▶ Run**.

---

## Google OAuth in the Native App

The native app uses `@capacitor/browser` to open Google's sign-in page in an
in-app browser, and a custom **deep link** (`shiftsync://`) to receive the JWT
token after authentication.

### How it works

1. User taps **"Continue with Google"**.
2. The app calls `/api/auth/google/mobile` on your server via
   `@capacitor/browser`.
3. The server starts the standard Google OAuth flow.
4. After Google authenticates the user, the server issues a JWT and redirects to
   `shiftsync://login?token=<JWT>`.
5. The OS hands the URL back to the ShiftSync app.
6. `@capacitor/app` fires `appUrlOpen`; the app extracts the token and logs in.

### Required server environment variables

Add `shiftsync://login` (and `shiftsync://login?*`) as an **Authorised redirect
URI** in your Google Cloud Console OAuth credentials.  Then redeploy with:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=https://your-server.onrender.com/api/auth/google/callback
CLIENT_URL=https://your-server.onrender.com
```

> The server already handles the `shiftsync://` redirect automatically when the
> OAuth flow is initiated from `/api/auth/google/mobile`.

### Deep-link scheme registration

Both manifests are pre-configured.

**Android** (`android/app/src/main/AndroidManifest.xml`) — already added:
```xml
<intent-filter android:autoVerify="false">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="shiftsync" />
</intent-filter>
```

**iOS** (`ios/App/App/Info.plist`) — already added:
```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>shiftsync</string>
        </array>
    </dict>
</array>
```

---

## Updating the Native App

Whenever you change the web app code:

```bash
cd client
npm run build:mobile   # rebuild with VITE_API_BASE_URL from .env.mobile
npx cap sync           # sync updated assets to android/ and ios/
```

Then rebuild in Android Studio / Xcode.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `VITE_API_BASE_URL` not set | Copy `.env.mobile.example` → `.env.mobile` and set the URL |
| API calls fail (network error) | Ensure `VITE_API_BASE_URL` matches your deployed server and HTTPS is used |
| Google sign-in button missing | Server `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` not set — configure them |
| `shiftsync://` deep link not fired | Ensure the URL scheme is registered (both manifests already done) |
| Android Studio "SDK not found" | Install Android SDK via **SDK Manager** in Android Studio |
| iOS build fails — no signing team | Set your Apple Developer Team in Xcode → **Signing & Capabilities** |
| CocoaPods error on iOS | Run `cd ios/App && pod install` |
