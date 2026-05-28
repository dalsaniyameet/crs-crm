const https = require('https');
require('dotenv').config({ path: '.env.local' });

const SECRET = process.env.CLERK_SECRET_KEY;
const UID = 'user_3ELM7zMwSdlhGiulYrYkxo4mnzt';
const PASSWORD = 'CRS@Admin2024';

function clerkReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.clerk.com', path, method,
      headers: {
        'Authorization': 'Bearer ' + SECRET,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({ raw }); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // 1. Verify password
  console.log('Testing password:', PASSWORD);
  const verify = await clerkReq('POST', '/v1/users/' + UID + '/verify_password', { password: PASSWORD });
  console.log('Password verify:', JSON.stringify(verify));

  // 2. Get user full details
  const user = await clerkReq('GET', '/v1/users/' + UID);
  console.log('\npassword_enabled:', user.password_enabled);
  console.log('two_factor_enabled:', user.two_factor_enabled);
  console.log('external_accounts:', user.external_accounts?.map(e => e.provider));
}

main().catch(e => console.error('Error:', e.message));
