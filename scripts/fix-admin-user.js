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
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({ raw }); } });
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
  console.log('Users found:', Array.isArray(users) ? users.length : 0);

  let userId;

  if (Array.isArray(users) && users.length > 0) {
    userId = users[0].id;
    console.log('Existing user ID:', userId);
    console.log('password_enabled:', users[0].password_enabled);

    // Update password
    const update = await clerkReq('PATCH', '/v1/users/' + userId, {
      password: PASSWORD,
      skip_password_checks: true,
    });
    if (update.id) {
      console.log('✅ Password updated! password_enabled:', update.password_enabled);
    } else {
      console.log('❌ Update error:', JSON.stringify(update));
    }
  } else {
    // Create user
    console.log('Creating new user...');
    const create = await clerkReq('POST', '/v1/users', {
      email_address: [EMAIL],
      password: PASSWORD,
      first_name: 'City Real',
      last_name: 'Space Admin',
      skip_password_checks: true,
    });
    if (create.id) {
      console.log('✅ User created! ID:', create.id, '| password_enabled:', create.password_enabled);
    } else {
      console.log('❌ Create error:', JSON.stringify(create));
    }
  }
}

main().catch(e => console.error('Fatal:', e.message));
