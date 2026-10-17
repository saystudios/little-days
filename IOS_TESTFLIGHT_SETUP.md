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
| `APP_STORE_PROFILE_BASE64` | App Store provisioning profile for `com.saystudios.littledays`, base64-encoded |

Encode a file on a Mac with `base64 -i file.p12 | pbcopy` and paste it as the secret value.

Before the first upload:
1. Register the explicit App ID `com.saystudios.littledays` at developer.apple.com → Identifiers.
2. Create the App Store provisioning profile for that App ID using your existing distribution certificate.
3. Create the Little Days app record in App Store Connect with the same bundle ID.

The build number is the workflow run number; the version comes from the run form. The workflow declares `ITSAppUsesNonExemptEncryption = false` because the app only uses standard HTTPS.

`.github/scripts/asc.rb` is the old temporary-certificate script. No workflow runs it; don't run it by hand, because it revokes certificates.

## Before App Store submission
Sign-in uses emailed codes, which work inside the app. Still to do (later phases): native local notifications, app icon and launch screen, privacy policy and App Store privacy answers, and full iPhone/iPad layout polish.
