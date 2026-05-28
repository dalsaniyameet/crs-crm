const https = require('https');
require('dotenv').config({ path: '.env.local' });

// Simulate exactly what the browser does when signing in with password
const PK = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const EMAIL = 'info@cityrealspace.com';
const PASSWORD = 'CRS@Admin2024';

// Extract frontend API URL from publishable key
// pk_live_Y2xlcmsuY2l0eXJlYWxzcGFjZWNybS5jb20k → base64 decode → clerk.cityrealspacecrm.com$
const decoded = Buffer.from(PK.replace('pk_live_', '').replace('pk_test_', ''), 'base64').toString('utf8');
const domain = decoded.replace('$', '').trim();
console.log('Clerk Frontend API domain:', domain);

function req(hostname, method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname, path, method,
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://cityrealspacecrm.com',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers,
      },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, body: raw }); } });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  console.log('\n--- Step 1: Create sign-in attempt ---');
  const res = await req(domain, 'POST', '/v1/client/sign_ins?_clerk_js_version=5.0.0', {
    identifier: EMAIL,
    password: PASSWORD,
    strategy: 'password',
  });
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(res.body, null, 2).slice(0, 800));
}

main().catch(e => console.error('Fatal:', e.message));
