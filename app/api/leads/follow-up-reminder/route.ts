import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const nowIST   = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const y = nowIST.getUTCFullYear(), mo = nowIST.getUTCMonth(), d = nowIST.getUTCDate();
    const tmrStart = new Date(Date.UTC(y, mo, d + 1, 0,  0,  0) - 5.5 * 60 * 60 * 1000);
    const tmrEnd   = new Date(Date.UTC(y, mo, d + 1, 23, 59, 59) - 5.5 * 60 * 60 * 1000);
    const nowUTC   = new Date();

    const [tomorrowTasks, overdueTasks] = await Promise.all([
      prisma.task.findMany({
        where: { dueAt: { gte: tmrStart, lte: tmrEnd }, isCompleted: false },
        include: {
          lead:       { select: { id: true, name: true, phone: true } },
          assignedTo: { select: { id: true, name: true } },
        },
        orderBy: { dueAt: "asc" },
        take: 50,
      }),
      prisma.task.findMany({
        where: { dueAt: { lt: nowUTC }, isCompleted: false },
        include: {
          lead:       { select: { id: true, name: true, phone: true } },
          assignedTo: { select: { id: true, name: true } },
        },
        orderBy: { dueAt: "asc" },
        take: 50,
      }),
    ]);

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });

    if (tomorrowTasks.length > 0) {
      const preview = tomorrowTasks.slice(0, 5)
        .map(t => `${t.lead?.name} — "${t.title}" (${t.assignedTo?.name || "Unassigned"})`)
        .join(", ") + (tomorrowTasks.length > 5 ? ` +${tomorrowTasks.length - 5} more` : "");

      await Promise.all(admins.map(a =>
        prisma.notification.create({
          data: { userId: a.id, type: "FOLLOW_UP_DUE", title: `📋 ${tomorrowTasks.length} Follow-ups Tomorrow`, message: preview },
        }).catch(() => {})
      ));

      const rows = tomorrowTasks.map(t =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #1e3a5f">${t.lead?.name || "—"}</td>
          <td style="padding:8px;border-bottom:1px solid #1e3a5f">${t.lead?.phone || "—"}</td>
          <td style="padding:8px;border-bottom:1px solid #1e3a5f">${t.title}</td>
          <td style="padding:8px;border-bottom:1px solid #1e3a5f">${t.assignedTo?.name || "Unassigned"}</td>
          <td style="padding:8px;border-bottom:1px solid #1e3a5f;color:#fbbf24">${new Date(t.dueAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</td>
        </tr>`
      ).join("");

      sendAdminEmail(
        `📋 ${tomorrowTasks.length} Follow-ups Scheduled for Tomorrow`,
        `<h2 style="color:#fde047">Tomorrow's Follow-up Tasks</h2>
         <table style="width:100%;border-collapse:collapse;margin-top:12px">
           <thead><tr style="background:#0f1f35">
             <th style="padding:8px;text-align:left;color:#94a3b8">Lead</th>
             <th style="padding:8px;text-align:left;color:#94a3b8">Phone</th>
             <th style="padding:8px;text-align:left;color:#94a3b8">Task</th>
             <th style="padding:8px;text-align:left;color:#94a3b8">Assigned To</th>
             <th style="padding:8px;text-align:left;color:#94a3b8">Time</th>
           </tr></thead>
           <tbody>${rows}</tbody>
         </table>`
      ).catch(() => {});
    }

    const brokerMap = new Map<string, typeof tomorrowTasks>();
    tomorrowTasks.forEach(t => {
      if (!t.assignedTo?.id) return;
      if (!brokerMap.has(t.assignedTo.id)) brokerMap.set(t.assignedTo.id, []);
      brokerMap.get(t.assignedTo.id)!.push(t);
    });
    for (const [brokerId, bTasks] of brokerMap) {
      await prisma.notification.create({
        data: {
          userId:  brokerId,
          type:    "FOLLOW_UP_DUE",
          title:   `📋 ${bTasks.length} Follow-up${bTasks.length > 1 ? "s" : ""} Tomorrow`,
          message: bTasks.map(t => `${t.lead?.name}: ${t.title}`).join(", "),
        },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, tomorrowTasks: tomorrowTasks.length, overdueTasks: overdueTasks.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
