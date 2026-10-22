// Network first, falling back to the cached copy when offline.
const CACHE='little-days-v13';
const ASSETS=['./','./index.html','./styles.css','./app.js','./kids.js','./lists.js','./kids-core.js','./climb-core.js','./climb.js','./climb.css','./planner-core.js','./reminders-core.js','./native.js','./sync-core.js','./item-sync.js','./cloud.js','./cloud-config.js','./reminders.js','./scan-core.js','./scan.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('little-days-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r}).catch(()=>caches.match(e.request)))});
