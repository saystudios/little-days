// Copies the website into www/ for the Capacitor iOS app, plus a bundled copy
// of supabase-js so sign-in and sync don't depend on a CDN inside the app.
import {mkdir,copyFile,access,readFile} from 'node:fs/promises';
import {WEB_FILES,referencedFiles} from './web-files.mjs';
const missing=referencedFiles(await readFile('index.html','utf8')).filter(f=>!WEB_FILES.includes(f)&&!f.startsWith('vendor/'));
if(missing.length){console.error(`index.html uses files that aren't packaged for iOS: ${missing.join(', ')}. Add them to scripts/web-files.mjs.`);process.exit(1);}
await mkdir('www/vendor',{recursive:true});
for(const name of WEB_FILES)await copyFile(name,'www/'+name);
const supabase='node_modules/@supabase/supabase-js/dist/umd/supabase.js';
try{await access(supabase);await copyFile(supabase,'www/vendor/supabase.js');console.log('Bundled supabase-js.')}
catch{console.warn('supabase-js not installed (run npm install); the app will load it from the CDN instead.')}
console.log(`Little Days web assets prepared for iOS (${WEB_FILES.length} files).`);
