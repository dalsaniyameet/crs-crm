const https = require('https');
require('dotenv').config({ path: '.env.local' });

const EMAIL = 'info@cityrealspace.com';
const PASSWORD = 'CRS@Admin2024';
const CLERK_DOMAIN = 'clerk.cityrealspacecrm.com';

function req(path, method, body, headers) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: CLERK_DOMAIN, path, method,
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://cityrealspacecrm.com',
        'Referer': 'https://cityrealspacecrm.com/',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers,
      },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  console.log('Testing live sign-in on clerk.cityrealspacecrm.com...\n');

  const res = await req('/v1/client/sign_ins', 'POST', {
    identifier: EMAIL,
    password: PASSWORD,
    strategy: 'password',
  });

  console.log('Status:', res.status);
  const errors = res.body?.errors || res.body?.response?.errors;
  if (errors) {
    console.log('❌ Error code:', errors[0]?.code);
    console.log('❌ Error msg:', errors[0]?.long_message || errors[0]?.message);
  } else {
    console.log('✅ Response:', JSON.stringify(res.body).slice(0, 300));
  }
}

main().catch(e => console.error('Fatal:', e.message));
