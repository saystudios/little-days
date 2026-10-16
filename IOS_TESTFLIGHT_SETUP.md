# Little Days iPhone preparation

The website at Cloudflare remains unchanged. The new `ios-preview.yml` GitHub Action compiles a Capacitor iOS Simulator app; it does NOT upload to TestFlight and the simulator ZIP cannot be installed on a physical iPhone.

1. In GitHub open **Actions → Little Days iOS build check → Run workflow**.
2. If the simulator build passes, register a **new explicit App ID** `com.saystudios.littledays` in the Apple Developer account that will distribute Little Days. If unavailable, change `capacitor.config.json` to an App ID you own.
3. In App Store Connect create a Little Days app tied to that App ID. Set app name, availability and privacy information.
4. Next, configure GitHub Actions signing using your Apple Developer Team ID, an App Store Connect API key and properly managed Apple Distribution certificate + App Store provisioning profile. Store all signing material in GitHub Actions Secrets, never source control.
5. Extend this workflow to produce and sign a device archive, upload with Xcode/App Store Connect, and test via TestFlight. The existing Say Math workflow is a reference but its certificate scripts and signing setup must be adapted carefully for this separate app.
6. This first package uses the existing web code and Supabase cloud connection. It is not a complete iOS-specific implementation of background push notifications. A website-open reminder cannot reliably notify after closing an iPhone app.
7. Before submitting: test login redirects for native app deep links, remote data syncing, offline handling, safe areas, the permission flow, privacy policy, child data handling and account deletion.
