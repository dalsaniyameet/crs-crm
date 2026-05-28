const https = require('https');
require('dotenv').config({ path: '.env.local' });

const SECRET = process.env.CLERK_SECRET_KEY;

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
  // Enable password strategy on the instance
  console.log('Enabling password strategy...');
  const result = await clerkReq('PATCH', '/v1/instance/restrictions', {
    allowlist: { enabled: false },
  });
  console.log('restrictions:', JSON.stringify(result));

  // Enable password in user settings
  console.log('\nUpdating user settings to enable password...');
  const settings = await clerkReq('PATCH', '/v1/instance/user_settings', {
    attributes: {
      password: {
        enabled: true,
        required: false,
      },
    },
  });
  console.log('user_settings result:', JSON.stringify(settings).slice(0, 400));
}

main().catch(e => console.error('Fatal:', e.message));
