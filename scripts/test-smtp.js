const nodemailer = require("nodemailer");

async function test(port, secure) {
  const t = nodemailer.createTransport({
    host: "smtpout.secureserver.net",
    port,
    secure,
    auth: { user: "info@cityrealspace.com", pass: "CRS@12477" },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
  try {
    await t.verify();
    console.log(`PORT ${port} secure=${secure} — OK`);
    const info = await t.sendMail({
      from: '"CRS CRM" <info@cityrealspace.com>',
      to: "meetdalsaniya143@gmail.com,info@cityrealspace.com",
      subject: "CRS CRM SMTP Test",
      html: "<h2>SMTP working on port " + port + "</h2>",
    });
    console.log("Sent:", info.messageId);
    return true;
  } catch (e) {
    console.log(`PORT ${port} secure=${secure} — FAIL: ${e.message}`);
    return false;
  }
}

(async () => {
  const ok587 = await test(587, false);
  if (!ok587) await test(465, true);
})();
