const https = require('https');

const EMAIL = 'info@cityrealspace.com';
const CLERK_DOMAIN = 'clerk.cityrealspacecrm.com';

function req(path, method, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: CLERK_DOMAIN, path, method,
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://cityrealspacecrm.com',
        'Referer': 'https://cityrealspacecrm.com/',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({ raw }); } });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  // Step 1: create sign_in with just identifier
  const step1 = await req('/v1/client/sign_ins', 'POST', { identifier: EMAIL });
  const signInId = step1.response?.id;
  console.log('sign_in id:', signInId);
  console.log('supported_first_factors:', JSON.stringify(step1.response?.supported_first_factors, null, 2));
}

main().catch(e => console.error(e.message));
