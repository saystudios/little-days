# Little Days — family sync setup (Supabase)

## New project
1. Create a Supabase project.
2. In the SQL Editor run `supabase/schema.sql`, then every file in `supabase/migrations/` in name order.
3. Put the project URL and **publishable/anon** key in `cloud-config.js` (see `cloud-config.example.js`). Never put a secret/service-role key in any web or app file.

## Existing project (already running schema.sql)
Run each file in `supabase/migrations/` that you haven't run yet, in name order. Each is safe to re-run and keeps all families and planners. After `20261017000000_family_security.sql`:
- Invite codes expire after 14 days (existing codes get 14 days from when you run it). Parents can make a new code in Settings, which revokes the old one.
- 5 wrong invite codes in 15 minutes blocks joining for 15 minutes. Families are capped at 8 parent accounts.
- Parents can see who is in their family, leave a family, and delete their account.
- Saves are time-stamped by the server and must be a valid planner under 2 MB.

## Email sign-in codes (required for the iPhone app)
Sign-in now asks for the code from the email, because email links can't open the iPhone app. In Supabase → Authentication → Emails → **Magic Link** template, include the code, for example:

```html
<h2>Your Little Days sign-in code</h2>
<p>Enter this code in Little Days: <strong>{{ .Token }}</strong></p>
<p>Or on the website, <a href="{{ .ConfirmationURL }}">tap here to sign in</a>.</p>
```

Keep Site URL set to the production website (Authentication → URL Configuration) so links still work on the web.

## How sync works
Since `20261018000000_item_sync.sql`, every activity, to-do, child, chore, routine, reward, reward request and chore/routine tick is its own row in `planner_items`. Devices send and receive single items, so a child ticking chores on a tablet while a parent edits the calendar on a phone never collide.

- **Same item changed on two devices:** the newest save wins, and the device that saved second shows a short notice.
- **Deletions** leave a "deleted" marker so every device removes the item.
- **Offline:** changes wait in a queue on the device (kept even if the app is closed) and send when the connection returns. The status pill shows "Offline · N waiting".
- **Live updates** arrive through Supabase Realtime, with a catch-up check every minute and whenever the app comes back to the foreground.
- `family_planners` is kept as a read-only backup of each family's planner from before the update.

**Order matters:** deploy the app version that includes item sync (it also works with the older database), then run the migration. The migration stops older app versions from saving to the old single document, so they show a sync error and reload into the new version instead of silently going out of step.

Before item sync, the whole planner was one shared document; that mode is still used automatically if the item-sync migration hasn't been run yet.

## Testing the database
`bash supabase/tests/run.sh` builds a throwaway database on any Postgres 16 (using the standard `PG*` connection variables), applies the schema and migrations and runs the security tests. The "Little Days tests" GitHub workflow runs this on every pull request.
