const https = require('https');
require('dotenv').config({ path: '.env.local' });

const SECRET = process.env.CLERK_SECRET_KEY;

function clerkReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.clerk.com',
      path, method,
      headers: {
        'Authorization': 'Bearer ' + SECRET,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = https.request(opts, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { resolve({ raw }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  console.log('Finding user...');
  const list = await clerkReq('GET', '/v1/users?email_address=info%40cityrealspace.com');
  const users = list.data || list;
  console.log('Users found:', Array.isArray(users) ? users.length : 'error', JSON.stringify(list).slice(0, 200));

  if (!Array.isArray(users) || !users.length) {
    console.log('User not found!');
    return;
  }

  const uid = users[0].id;
  console.log('User ID:', uid);

  const result = await clerkReq('PATCH', '/v1/users/' + uid, {
    password: 'CRS@Admin2024',
    skip_password_checks: true,
    skip_password_requirement: true,
  });

  if (result.id) {
    console.log('✅ Password set successfully!');
    console.log('Email:', result.email_addresses?.[0]?.email_address);
    console.log('Password enabled:', result.password_enabled);
  } else {
    console.log('❌ Error:', JSON.stringify(result));
  }
}

main().catch(e => console.error('Fatal:', e.message));
