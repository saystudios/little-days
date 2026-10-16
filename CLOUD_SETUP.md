# Little Days optional family cloud sync

1. Create a Supabase project.
2. Run `supabase/schema.sql` in its SQL Editor. Enable email sign-in / magic links and set Site URL to your production website in Supabase Authentication URL Configuration.
3. Copy `cloud-config.example.js` to `cloud-config.js` and replace the URL and publishable/anon key (NEVER put a Supabase secret/service-role key in web files). Commit cloud-config.js to GitHub.
4. Deploy the new version. Sign in using the Family cloud account panel; choose Create family, then send the invite code privately to the second parent. They log in with their own email and select Join.
5. Existing local data uploads when creating a family. Joining a family replaces local schedules with the cloud data. Export a backup before joining.
6. This is a first shared-document sync with 30-second polling and last-write-wins updates, not real-time conflict-safe collaborative editing. Avoid editing simultaneously on multiple devices.
7. Browser reminders while the page is open may work, but reliable automatic push/email reminders are NOT configured. Supabase/worker cron plus notification delivery and explicit consent must be added first.
8. Protect child data: enable appropriate authentication security and consider restricting invitations, rate limiting and backup before production release.
