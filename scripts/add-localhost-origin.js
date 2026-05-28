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
  console.log('Adding localhost:3000 to allowed origins...');
  const result = await clerkReq('PATCH', '/v1/instance', {
    allowed_origins: ['http://localhost:3000', 'https://cityrealspacecrm.com'],
  });
  console.log('Result:', JSON.stringify(result));
}

main().catch(e => console.error('Fatal:', e.message));
