const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host:   "smtpout.secureserver.net",
  port:   465,
  secure: true,
  auth: {
    user: "info@cityrealspace.com",
    pass: "CRS@12477",
  },
});

async function sendTest() {
  try {
    const info = await transporter.sendMail({
      from:    '"City Real Space CRM" <info@cityrealspace.com>',
      to:      "meetdalsaniya143@gmail.com, info@cityrealspace.com",
      subject: "✅ CRM Email Test — City Real Space",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#0f172a;padding:30px;border-radius:12px">
          <h2 style="color:#f59e0b;margin:0 0 8px">🏠 City Real Space CRM</h2>
          <p style="color:#94a3b8;margin:0 0 20px;font-size:14px">Email Notification System</p>
          <div style="background:#1e293b;padding:20px;border-radius:8px">
            <p style="color:#fff;font-size:16px;margin:0 0 12px">✅ Email working perfectly!</p>
            <p style="color:#94a3b8;font-size:13px;margin:0">Ab jab bhi koi lead, deal, visit, ya leave aayegi — aapko turant email milegi.</p>
          </div>
          <p style="color:#475569;font-size:12px;margin-top:20px;text-align:center">City Real Space | Ahmedabad</p>
        </div>
      `,
    });
    console.log("✅ Email sent! Message ID:", info.messageId);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

sendTest();
