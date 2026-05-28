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
  // Try v1/beta/instance/user_settings
  const endpoints = [
    ['GET', '/v1/beta/instance'],
    ['GET', '/v1/instance/organization_settings'],
    ['PATCH', '/v1/instance', { password_settings: { allowed: true } }],
    ['PATCH', '/v1/instance', { auth_config: { password_settings: { allowed: true } } }],
  ];

  for (const [method, path, body] of endpoints) {
    const r = await clerkReq(method, path, body);
    console.log(`${method} ${path} →`, JSON.stringify(r).slice(0, 200));
    console.log('---');
  }
}

main().catch(e => console.error('Fatal:', e.message));
