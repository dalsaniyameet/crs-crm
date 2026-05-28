const https = require('https');
require('dotenv').config({ path: '.env.local' });

const SECRET = process.env.CLERK_SECRET_KEY;
const UID = 'user_3E5TUIlS8bHnP1ezzmsxVq7X4Kd';
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
  const verify = await clerkReq('POST', '/v1/users/' + UID + '/verify_password', { password: PASSWORD });
  if (verify.verified) {
    console.log('✅ Password is CORRECT! Login will work.');
  } else {
    console.log('❌ Password wrong:', JSON.stringify(verify));
  }
}

main().catch(e => console.error(e.message));
