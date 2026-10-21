// Run after `npx cap sync ios`: proves the iOS project really contains every
// web file (including Sports & Meals) and every native plugin the app uses.
import {readFile,access} from 'node:fs/promises';
import {WEB_FILES,NATIVE_PLUGINS} from '../../scripts/web-files.mjs';
const errors=[];
const exists=p=>access(p).then(()=>true,()=>false);
for(const f of WEB_FILES)if(!(await exists('ios/App/App/public/'+f)))errors.push(`Missing from the iOS app bundle: ${f}`);
const html=await readFile('ios/App/App/public/index.html','utf8').catch(()=> '');
for(const f of ['sports-meals.js','sports-meals.css'])if(!html.includes(f))errors.push(`index.html in the iOS bundle doesn't load ${f}`);
const project=[await readFile('ios/App/Podfile','utf8').catch(()=> ''),await readFile('ios/App/CapApp-SPM/Package.swift','utf8').catch(()=> '')].join('\n');
for(const p of NATIVE_PLUGINS)if(!project.includes(p))errors.push(`Native plugin ${p} isn't in the iOS project (run npm install, then npx cap sync ios)`);
const cfg=JSON.parse(await readFile('ios/App/App/capacitor.config.json','utf8').catch(()=> '{}'));
if(Array.isArray(cfg.packageClassList)){
  for(const c of ['LocalNotificationsPlugin','AppLauncherPlugin'])if(!cfg.packageClassList.includes(c))errors.push(`${c} isn't registered in ios/App/App/capacitor.config.json`);
  console.log('Registered native plugins:',cfg.packageClassList.join(', '));
}
if(errors.length){for(const e of errors)console.log(`::error::${e}`);process.exit(1);}
console.log(`iOS bundle OK: ${WEB_FILES.length} web files and ${NATIVE_PLUGINS.length} native plugins present.`);
