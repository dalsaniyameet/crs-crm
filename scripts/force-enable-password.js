const https = require('https');
require('dotenv').config({ path: '.env.local' });

const SECRET = process.env.CLERK_SECRET_KEY;
const EMAIL = 'info@cityrealspace.com';
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
      res.on('end', () => {
        if (!raw) { resolve({ ok: true, status: res.statusCode }); return; }
        try { resolve(JSON.parse(raw)); } catch { resolve({ raw, status: res.statusCode }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // Find user
  const list = await clerkReq('GET', '/v1/users?email_address=' + encodeURIComponent(EMAIL));
  const users = list.data || list;
  if (!Array.isArray(users) || !users.length) { console.log('User not found'); return; }

  const u = users[0];
  console.log('User ID:', u.id);
  console.log('password_enabled before:', u.password_enabled);
  console.log('external_accounts:', u.external_accounts?.map(e => e.provider));

  // Force set password with all bypass flags
  const result = await clerkReq('PATCH', '/v1/users/' + u.id, {
    password: PASSWORD,
    skip_password_checks: true,
    skip_password_requirement: true,
  });

  if (result.id) {
    console.log('\n✅ Done!');
    console.log('password_enabled after:', result.password_enabled);
  } else {
    console.log('\n❌ Error:', JSON.stringify(result));
  }

  // Verify password works
  const verify = await clerkReq('POST', '/v1/users/' + u.id + '/verify_password', { password: PASSWORD });
  console.log('Password verify:', verify.verified ? '✅ CORRECT' : '❌ WRONG - ' + JSON.stringify(verify));
}

main().catch(e => console.error('Fatal:', e.message));
