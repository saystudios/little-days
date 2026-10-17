# Little Days — iPhone/iPad builds and TestFlight

The Cloudflare website is not affected by these workflows.

## Build check (no signing)
**Actions → Little Days iOS build check → Run workflow** compiles a Simulator build. It also runs automatically when app files change on `main`. The simulator ZIP cannot be installed on a real iPhone.

## TestFlight
**Actions → Little Days TestFlight → Run workflow** builds a signed archive and uploads it to App Store Connect. It reuses one distribution certificate and profile stored as secrets — it never creates or revokes Apple certificates.

Required GitHub Actions secrets (Settings → Secrets and variables → Actions):

| Secret | What it is |
|---|---|
| `APPLE_TEAM_ID` | 10-character Team ID from developer.apple.com → Membership |
| `ASC_KEY_ID` | App Store Connect API key ID |
| `ASC_ISSUER_ID` | App Store Connect API issuer ID |
| `ASC_KEY_P8` | Full text of the `AuthKey_XXXX.p8` file, including the BEGIN/END lines |
| `APPLE_DISTRIBUTION_P12_BASE64` | Your existing Apple Distribution certificate exported as .p12, base64-encoded |
| `APPLE_DISTRIBUTION_P12_PASSWORD` | Password for that .p12 |
| `APP_STORE_PROFILE_BASE64` | *Optional.* App Store provisioning profile for `com.saystudios.littledays`, base64-encoded. If it's not set, the build gets one from App Store Connect with the API key (see below). |

Encode a file on a Mac with `base64 -i file.p12 | pbcopy` and paste it as the secret value.

Before the first upload:
1. Register the explicit App ID `com.saystudios.littledays` at developer.apple.com → Identifiers.
2. Create the Little Days app record in App Store Connect with the same bundle ID.

**Provisioning profile.** Without the `APP_STORE_PROFILE_BASE64` secret, each build finds the distribution certificate from the .p12 in App Store Connect (by serial number) and reuses a valid App Store profile for `com.saystudios.littledays` that includes it, or creates one if there isn't one (`.github/scripts/app-store-profile.mjs`). It never creates or revokes certificates and never registers App IDs. The API key needs the Admin or App Manager role for this. To pin a specific profile instead, add it as `APP_STORE_PROFILE_BASE64`.

The build number is the workflow run number; the version comes from the run form. The workflow declares `ITSAppUsesNonExemptEncryption = false` because the app only uses standard HTTPS.

`.github/scripts/asc.rb` is the old temporary-certificate script. No workflow runs it; don't run it by hand, because it revokes certificates.

## What the iPhone/iPad app adds over the website
- **Reminders that arrive when the app is closed** (Settings → Reminders): before activities, birthdays, an optional morning summary, and quiet hours. They're scheduled on the device with iOS notifications (no server needed), up to a week ahead, and refreshed whenever the planner changes or the app is opened. iOS allows 64 waiting notifications per app; Little Days uses at most 60, soonest first.
- **Storage backup:** the planner and the sync queue are also kept in the app's native storage and restored automatically if iOS clears the web view's storage to free space.
- Haptic taps when ticking things off, a status bar that follows light/dark mode, a launch screen, and a refresh when the app comes back to the foreground.
- Long-press and drag to move activities in Week and Month view.
- App icon and launch screens are generated during the build from `resources/icon.png`, `resources/splash.png` and `resources/splash-dark.png` (`npm run ios:assets`). Replace those files to change the artwork.

Plugins used (installed by `npm install` in the workflows): App, Haptics, Keyboard, Local Notifications, Preferences, Splash Screen, Status Bar. No Apple Push Notification (APNs) key is needed for these reminders. Server-sent push (for example "Leo finished his chores" on a parent's phone) would need an APNs key and a small server function; it's not part of this version.

## Before App Store submission
Phase 6 covers the privacy policy, App Store privacy answers, final device testing and TestFlight.
