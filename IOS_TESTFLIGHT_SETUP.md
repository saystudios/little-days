# Little Days iPhone preparation

The website at Cloudflare remains unchanged. The new `ios-preview.yml` GitHub Action compiles a Capacitor iOS Simulator app; it does NOT upload to TestFlight and the simulator ZIP cannot be installed on a physical iPhone.

1. In GitHub open **Actions → Little Days iOS build check → Run workflow**.
2. If the simulator build passes, register a **new explicit App ID** `com.saystudios.littledays` in the Apple Developer account that will distribute Little Days. If unavailable, change `capacitor.config.json` to an App ID you own.
3. In App Store Connect create a Little Days app tied to that App ID. Set app name, availability and privacy information.
4. Configure GitHub Actions secrets APPLE_TEAM_ID, ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8. The TestFlight workflow generates a temporary Apple Distribution certificate and Little Days App Store provisioning profile through App Store Connect. Do not put private keys in source control.
5. Run Actions → Little Days TestFlight → Run workflow to build and upload the signed device archive. The signing automation was adapted from Say Math. Review the GitHub log and confirm processing in App Store Connect.
6. This first package uses the existing web code and Supabase cloud connection. It is not a complete iOS-specific implementation of background push notifications. A website-open reminder cannot reliably notify after closing an iPhone app.
7. Before submitting: test login redirects for native app deep links, remote data syncing, offline handling, safe areas, the permission flow, privacy policy, child data handling and account deletion.
