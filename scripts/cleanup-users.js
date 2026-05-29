const https = require('https');
require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SECRET = process.env.CLERK_SECRET_KEY;

const KEEP_EMAILS = [
  'meniyaajit1@gmail.com',
  'jyotsanachaudhary287@gmail.com',
  'info@cityrealspace.com',
  'meetdalsaniya143@gmail.com',
];

function clerkReq(method, path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.clerk.com', path, method,
      headers: { 'Authorization': 'Bearer ' + SECRET, 'Content-Type': 'application/json' },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        if (!raw) { resolve({ ok: true }); return; }
        try { resolve(JSON.parse(raw)); } catch { resolve({ raw }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Get users to delete
  const toDelete = await prisma.user.findMany({
    where: { email: { notIn: KEEP_EMAILS, mode: 'insensitive' } },
    select: { id: true, email: true, clerkId: true },
  });
  console.log('Users to delete:', toDelete.map(u => u.email));

  for (const u of toDelete) {
    // Delete related records first
    await prisma.chatMember.deleteMany({ where: { userId: u.id } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { userId: u.id } }).catch(() => {});
    await prisma.attendance.deleteMany({ where: { userId: u.id } }).catch(() => {});
    await prisma.leaveRequest.deleteMany({ where: { userId: u.id } }).catch(() => {});
    await prisma.dailyReport.deleteMany({ where: { userId: u.id } }).catch(() => {});
    await prisma.employeeProfile.deleteMany({ where: { userId: u.id } }).catch(() => {});
    await prisma.employeeDocument.deleteMany({ where: { userId: u.id } }).catch(() => {});
    await prisma.salarySlip.deleteMany({ where: { userId: u.id } }).catch(() => {});
    await prisma.callLog.deleteMany({ where: { userId: u.id } }).catch(() => {});
    await prisma.activity.deleteMany({ where: { userId: u.id } }).catch(() => {});
    await prisma.task.deleteMany({ where: { assignedTo: u.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: u.id } });
    console.log(`✅ DB deleted: ${u.email}`);

    // Delete from Clerk
    if (u.clerkId) {
      const del = await clerkReq('DELETE', `/v1/users/${u.clerkId}`);
      console.log(`🗑 Clerk: ${u.email} →`, del.deleted ? '✅' : JSON.stringify(del).slice(0, 60));
    }
  }

  // Also delete Clerk users not in DB
  const clerkList = await clerkReq('GET', '/v1/users?limit=100');
  const clerkUsers = clerkList.data || clerkList;
  for (const cu of clerkUsers) {
    const email = cu.email_addresses?.[0]?.email_address?.toLowerCase();
    if (!KEEP_EMAILS.map(e => e.toLowerCase()).includes(email)) {
      const del = await clerkReq('DELETE', `/v1/users/${cu.id}`);
      console.log(`🗑 Clerk extra: ${email} →`, del.deleted ? '✅' : JSON.stringify(del).slice(0, 60));
    } else {
      console.log(`⏭ Keep: ${email}`);
    }
  }

  console.log('\n✅ Cleanup done!');
}

main().catch(e => console.error('Fatal:', e.message)).finally(() => prisma.$disconnect());
