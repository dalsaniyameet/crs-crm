const https = require('https');

const EMAIL = 'info@cityrealspace.com';
const PASSWORD = 'CRS@Admin2024';
const CLERK_DOMAIN = 'clerk.cityrealspacecrm.com';

function req(path, method, body, cookie) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: CLERK_DOMAIN, path, method,
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://cityrealspacecrm.com',
        'Referer': 'https://cityrealspacecrm.com/sign-in',
        'User-Agent': 'Mozilla/5.0',
        ...(cookie ? { 'Cookie': cookie } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, res => {
      let raw = '';
      const setCookie = res.headers['set-cookie'];
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw), setCookie }); }
        catch { resolve({ status: res.statusCode, body: raw, setCookie }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  // Step 1: Get client token first
  console.log('Step 1: Init client...');
  const init = await req('/v1/client?_clerk_js_version=5.0.0', 'GET', null, null);
  console.log('Status:', init.status);
  const clientCookie = init.setCookie?.map(c => c.split(';')[0]).join('; ');
  console.log('Cookie:', clientCookie?.slice(0, 80));

  // Step 2: Create sign-in with identifier
  console.log('\nStep 2: Create sign-in with identifier...');
  const step2 = await req('/v1/client/sign_ins?_clerk_js_version=5.0.0', 'POST', { identifier: EMAIL }, clientCookie);
  console.log('Status:', step2.status);
  const signInId = step2.body?.response?.id;
  const factors = step2.body?.response?.supported_first_factors?.map(f => f.strategy);
  console.log('sign_in id:', signInId);
  console.log('supported_first_factors:', factors);

  if (!factors?.includes('password')) {
    console.log('\n❌ Password strategy NOT available for this user on live Clerk.');
    console.log('→ Go to dashboard.clerk.com → Configure → Email, Phone, Username');
    console.log('→ Under "Authentication strategies" enable Password as Optional');
    return;
  }

  // Step 3: Attempt password
  console.log('\nStep 3: Attempt password...');
  const allCookies = [clientCookie, ...(step2.setCookie?.map(c => c.split(';')[0]) || [])].filter(Boolean).join('; ');
  const step3 = await req(`/v1/client/sign_ins/${signInId}/attempt_first_factor?_clerk_js_version=5.0.0`, 'POST',
    { strategy: 'password', password: PASSWORD }, allCookies);
  console.log('Status:', step3.status);
  console.log('Result status:', step3.body?.response?.status);
  if (step3.body?.errors) console.log('Errors:', JSON.stringify(step3.body.errors));
}

main().catch(e => console.error('Fatal:', e.message));
