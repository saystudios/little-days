// Every file the app needs at runtime. prepare-web.mjs copies these into www/
// for the iOS app; tests and CI check index.html doesn't use anything missing.
export const WEB_FILES = ['index.html', 'styles.css', 'app.js', 'kids.js', 'lists.js', 'kids-core.js', 'planner-core.js',
  'reminders-core.js', 'native.js', 'sync-core.js', 'item-sync.js', 'cloud.js', 'cloud-config.js', 'reminders.js',
  'scan-core.js', 'scan.js', 'sports-meals.js', 'sports-meals.css', 'family-upgrades.js', 'manifest.webmanifest', 'icon.svg', 'sw.js'];
// Native plugins the app calls through Capacitor; each must be in the iOS project.
export const NATIVE_PLUGINS = ['@capacitor/local-notifications', '@capacitor/app-launcher', '@capacitor/preferences',
  '@capacitor/app', '@capacitor/haptics', '@capacitor/keyboard', '@capacitor/splash-screen', '@capacitor/status-bar'];
/* Local files referenced by <script src> and <link href> in index.html. */
export function referencedFiles(html) {
  return [...html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*\shref)="([^"]+)"/g)].map(m => m[1])
    .filter(u => !/^(https?:)?\/\//.test(u) && !u.startsWith('data:'))
    .map(u => u.replace(/^\.\//, '').split(/[?#]/)[0]);
}
