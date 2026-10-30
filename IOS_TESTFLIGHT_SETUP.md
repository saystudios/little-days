# Little Days — iPhone/iPad builds and TestFlight

The Cloudflare website is not affected by these workflows.

## Build check (no signing)
**Actions → Little Days iOS build check → Run workflow** compiles a Simulator build. It also runs automatically when app files change on `main`. The simulator ZIP cannot be installed on a real iPhone.

## TestFlight
**Actions → Little Days TestFlight → Run workflow** builds with the newest Xcode 26+ on GitHub's Mac runner and uploads to App Store Connect. The build number is the workflow run number; the version comes from the run form.

**Signing (no Mac or .p12 needed).** The app is archived unsigned and then signed at export by Apple's *cloud-managed* distribution certificate, using the App Store Connect API key (`-allowProvisioningUpdates`). Apple keeps that certificate; nothing is created on the runner and no certificates are ever revoked. The API key must have the **Admin** role.

Required GitHub Actions secrets (Settings → Secrets and variables → Actions):

| Secret | What it is |
|---|---|
| `APPLE_TEAM_ID` | 10-character Team ID from developer.apple.com → Membership |
| `ASC_KEY_ID` | App Store Connect API key ID (Admin role) |
| `ASC_ISSUER_ID` | App Store Connect API issuer ID |
| `ASC_KEY_P8` | Full text of the `AuthKey_XXXX.p8` file, including the BEGIN/END lines |

Optional — only if you'd rather sign with your own saved certificate:

| Secret | What it is |
|---|---|
| `APPLE_DISTRIBUTION_P12_BASE64` | An existing Apple Distribution certificate exported as .p12, base64-encoded |
| `APPLE_DISTRIBUTION_P12_PASSWORD` | Password for that .p12 |
| `APP_STORE_PROFILE_BASE64` | *Optional even then.* If missing, the build reuses or creates an App Store profile for that certificate through the API (`.github/scripts/app-store-profile.mjs`). |

Before the first upload, `com.saystudios.littledays` must be registered at developer.apple.com → Identifiers and have an app record in App Store Connect. The build never registers App IDs.

The workflow declares `ITSAppUsesNonExemptEncryption = false` because the app only uses standard HTTPS. App Store Connect requires builds made with Xcode 26 / the iOS 26 SDK or later; the workflow picks the newest non-beta Xcode 26+ on the runner.

Apple secrets are only given to the workflow steps that need them (not to `npm install` or the icon generator), and the workflow can only read this repository.

## What the iPhone/iPad app adds over the website
- **Reminders that arrive when the app is closed** (Settings → Reminders): before activities, birthdays, an optional morning summary, and quiet hours. They're scheduled on the device with iOS notifications (no server needed), up to a week ahead, and refreshed whenever the planner changes or the app is opened. iOS allows 64 waiting notifications per app; Little Days uses at most 60, soonest first.
- **Storage backup:** the planner and the sync queue are also kept in the app's native storage and restored automatically if iOS clears the web view's storage to free space.
- Haptic taps when ticking things off, a status bar that follows light/dark mode, a launch screen, and a refresh when the app comes back to the foreground.
- Long-press and drag to move activities in Week and Month view.
- App icon and launch screens are generated during the build from `resources/icon.png`, `resources/splash.png` and `resources/splash-dark.png` (`npm run ios:assets`). Replace those files to change the artwork.

Plugins used (installed by `npm install` in the workflows): App, Haptics, Keyboard, Local Notifications, Preferences, Splash Screen, Status Bar. No Apple Push Notification (APNs) key is needed for these reminders. Server-sent push (for example "Leo finished his chores" on a parent's phone) would need an APNs key and a small server function; it's not part of this version.

## Before App Store submission
Phase 6 covers the privacy policy, App Store privacy answers, final device testing and TestFlight.
