import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { WEB_FILES, NATIVE_PLUGINS, referencedFiles } from '../scripts/web-files.mjs';

test('every file index.html loads is packaged for the iOS app', () => {
  const used = referencedFiles(readFileSync('index.html', 'utf8')).filter(f => !f.startsWith('vendor/'));
  assert.ok(used.includes('sports-meals.js') && used.includes('sports-meals.css'));
  for (const f of used) assert.ok(WEB_FILES.includes(f), `${f} is missing from scripts/web-files.mjs`);
});

test('every packaged file exists', () => {
  for (const f of WEB_FILES) assert.ok(existsSync(f), `${f} does not exist`);
});

test('every native plugin the app uses is a dependency', () => {
  const deps = JSON.parse(readFileSync('package.json', 'utf8')).dependencies;
  for (const p of NATIVE_PLUGINS) assert.ok(deps[p], `${p} missing from package.json`);
});
