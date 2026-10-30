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

test('index.html works with the website security policy (no inline scripts or handlers)', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)[^>]*>/, 'inline <script> found; move it into a file');
  assert.doesNotMatch(html, /<[^>]+\son[a-z]+\s*=/i, 'inline event handler (onload=, onclick=…) found');
});

test('the website security policy allows the Supabase project', () => {
  const headers = readFileSync('_headers', 'utf8');
  const csp = headers.match(/Content-Security-Policy: (.+)/)?.[1] || '';
  const url = readFileSync('cloud-config.js', 'utf8').match(/url: '(https:\/\/[^']+)'/)[1];
  assert.ok(csp.includes(`connect-src 'self' ${url} ${url.replace('https://', 'wss://')}`), 'connect-src must list the Supabase URL from cloud-config.js');
  assert.ok(!/unsafe-eval/.test(csp) && !/script-src[^;]*unsafe-inline/.test(csp), 'scripts must stay locked down');
  assert.match(headers, /frame-ancestors 'none'/);
});
