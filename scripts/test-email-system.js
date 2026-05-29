const nodemailer = require('nodemailer');
require('dotenv').config({ path: '.env.local' });

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Set' : '❌ Missing');
console.log('ADMIN_EMAILS:', ADMIN_EMAILS);

async function test() {
  const t = nodemailer.createTransport({
    host:   process.env.EMAIL_HOST || 'smtpout.secureserver.net',
    port:   parseInt(process.env.EMAIL_PORT || '465'),
    secure: process.env.EMAIL_SECURE !== 'false',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    await t.verify();
    console.log('\n✅ SMTP connection OK');
  } catch (err) {
    console.error('\n❌ SMTP connection FAILED:', err.message);
    return;
  }

  try {
    const info = await t.sendMail({
      from: `"City Real Space CRM" <${process.env.EMAIL_USER}>`,
      to: ADMIN_EMAILS.join(', '),
      subject: '✅ CRM Test Email — Punch In/Out & Notifications Working',
      html: `
        <div style="font-family:Arial;padding:20px;background:#0f172a;color:#fff;border-radius:8px">
          <h2 style="color:#f59e0b">🏙️ City Real Space CRM</h2>
          <p>This is a test email to confirm all notifications are working.</p>
          <ul>
            <li>✅ Punch In/Out alerts</li>
            <li>✅ Leave requests</li>
            <li>✅ New leads</li>
            <li>✅ Deals & commissions</li>
            <li>✅ Daily reports</li>
          </ul>
          <p style="color:#94a3b8;font-size:12px">Sent from CRM test script</p>
        </div>
      `,
    });
    console.log('✅ Test email sent! Message ID:', info.messageId);
    console.log('Delivered to:', ADMIN_EMAILS.join(', '));
  } catch (err) {
    console.error('❌ Email send FAILED:', err.message);
  }
}

test();
