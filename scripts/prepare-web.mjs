import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('www',{recursive:true});
for(const name of ['index.html','cloud.js','cloud-config.js','reminders.js','manifest.webmanifest','icon.svg','sw.js']){
 await copyFile(name,'www/'+name);
}
console.log('Little Days web assets prepared for iOS.');
