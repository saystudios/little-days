// Copies the website into www/ for the Capacitor iOS app, plus a bundled copy
// of supabase-js so sign-in and sync don't depend on a CDN inside the app.
import {mkdir,copyFile,access} from 'node:fs/promises';
const files=['index.html','styles.css','app.js','kids.js','lists.js','kids-core.js','planner-core.js','sync-core.js','item-sync.js','cloud.js','cloud-config.js','reminders.js','manifest.webmanifest','icon.svg','sw.js'];
await mkdir('www/vendor',{recursive:true});
for(const name of files)await copyFile(name,'www/'+name);
const supabase='node_modules/@supabase/supabase-js/dist/umd/supabase.js';
try{await access(supabase);await copyFile(supabase,'www/vendor/supabase.js');console.log('Bundled supabase-js.')}
catch{console.warn('supabase-js not installed (run npm install); the app will load it from the CDN instead.')}
console.log('Little Days web assets prepared for iOS.');
