// Gets an App Store provisioning profile for Little Days from App Store Connect,
// using the existing distribution certificate (matched by serial number).
// Reuses a valid profile when there is one, otherwise creates one.
// It never creates, changes or revokes certificates, and never registers App IDs.
//
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8, BUNDLE_ID, CERT_SERIAL, OUT
// (ASC_API_BASE is only for tests.)
import { createSign } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const env = (k) => {
  const v = process.env[k];
  if (!v) fail(`Missing ${k}`);
  return v;
};
function fail(msg) {
  console.log(`::error::${msg}`);
  process.exit(1);
}

const BASE = process.env.ASC_API_BASE || 'https://api.appstoreconnect.apple.com';
const bundle = env('BUNDLE_ID');
const serial = normSerial(env('CERT_SERIAL'));
const out = env('OUT');

function normSerial(s) {
  return String(s).replace(/^serial=/i, '').replace(/[^0-9a-f]/gi, '').replace(/^0+/, '').toUpperCase();
}

function token() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const data = `${b64({ alg: 'ES256', kid: env('ASC_KEY_ID'), typ: 'JWT' })}.${b64({
    iss: env('ASC_ISSUER_ID'), iat: now, exp: now + 1200, aud: 'appstoreconnect-v1',
  })}`;
  const sig = createSign('SHA256').update(data).sign({ key: env('ASC_KEY_P8'), dsaEncoding: 'ieee-p1363' });
  return `${data}.${sig.toString('base64url')}`;
}
const auth = `Bearer ${token()}`;

async function api(path, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { Authorization: auth, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (body.errors || []).map((e) => e.detail || e.title).join('; ');
    fail(`App Store Connect ${init.method || 'GET'} ${path.split('?')[0]} failed (${res.status}): ${detail || res.statusText}`);
  }
  return body;
}

// 1. The App ID must already exist (this script doesn't register it).
const ids = await api(`/v1/bundleIds?filter[identifier]=${encodeURIComponent(bundle)}&limit=200`);
const bundleId = (ids.data || []).find((b) => b.attributes?.identifier === bundle);
if (!bundleId) fail(`App ID ${bundle} isn't registered. Add it at developer.apple.com → Identifiers, then run the build again.`);

// 2. The certificate in the .p12 must be one of the team's distribution certificates.
const certs = await api('/v1/certificates?filter[certificateType]=DISTRIBUTION,IOS_DISTRIBUTION&limit=200');
const cert = (certs.data || []).find((c) => normSerial(c.attributes?.serialNumber || '') === serial);
if (!cert) fail('The certificate in APPLE_DISTRIBUTION_P12_BASE64 is not a current Apple Distribution certificate for this team (it may have expired or been revoked).');
console.log(`Using distribution certificate ${cert.attributes.name || cert.id} (expires ${cert.attributes.expirationDate || 'unknown'})`);

// 3. Reuse a valid App Store profile for this App ID that includes the certificate.
const soon = Date.now() + 2 * 24 * 3600 * 1000;
const profiles = await api(`/v1/bundleIds/${bundleId.id}/profiles?limit=200`);
let chosen = null;
for (const p of profiles.data || []) {
  const a = p.attributes || {};
  if (a.profileType !== 'IOS_APP_STORE' || a.profileState !== 'ACTIVE') continue;
  if (a.expirationDate && Date.parse(a.expirationDate) < soon) continue;
  const pc = await api(`/v1/profiles/${p.id}/certificates?limit=200`);
  if ((pc.data || []).some((c) => c.id === cert.id)) { chosen = p; break; }
}

// 4. Otherwise create one.
if (chosen) {
  const full = await api(`/v1/profiles/${chosen.id}`);
  chosen = full.data;
  console.log(`Reusing provisioning profile "${chosen.attributes.name}"`);
} else {
  const name = `Little Days App Store ${new Date().toISOString().slice(0, 10)} ${Date.now() % 100000}`;
  const made = await api('/v1/profiles', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'profiles',
        attributes: { name, profileType: 'IOS_APP_STORE' },
        relationships: {
          bundleId: { data: { type: 'bundleIds', id: bundleId.id } },
          certificates: { data: [{ type: 'certificates', id: cert.id }] },
        },
      },
    }),
  });
  chosen = made.data;
  console.log(`Created provisioning profile "${chosen.attributes.name}"`);
}

const content = chosen.attributes?.profileContent;
if (!content) fail('App Store Connect returned a profile without its content.');
writeFileSync(out, Buffer.from(content, 'base64'));
