import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { sendEmployeeEmail, empLeaveStatusEmailHtml, leaveRequestEmailHtml, sendAdminEmail } from "@/lib/email";

async function isAdmin(userId: string) {
  const u = await prisma.user.findUnique({ where: { clerkId: userId }, select: { role: true } });
  return u?.role?.toUpperCase() === "ADMIN";
}

// PATCH — admin approves/rejects leave
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { status, adminNote } = await req.json();
  if (!["APPROVED", "REJECTED"].includes(status))
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const leave = await prisma.leaveRequest.update({
    where: { id: params.id },
    data: { status, adminNote: adminNote || null },
    include: { employee: true },
  });

  // Notify employee — DB notification
  try {
    const empUser = await prisma.user.findFirst({ where: { email: leave.employee.email } });
    if (empUser) {
      await prisma.notification.create({
        data: {
          userId:  empUser.id,
          type:    "LEAVE_REQUEST",
          title:   status === "APPROVED" ? `✅ Leave Approved` : `❌ Leave Rejected`,
          message: `Your ${leave.type.replace(/_/g, " ")} leave (${leave.days} day${leave.days !== 1 ? "s" : ""}) from ${new Date(leave.fromDate).toLocaleDateString("en-IN")} has been ${status.toLowerCase()}.${adminNote ? ` Note: ${adminNote}` : ""}`,
        },
      });
    }

    // Email to employee
    sendEmployeeEmail(
      leave.employee.email,
      `${status === "APPROVED" ? "✅ Leave Approved" : "❌ Leave Rejected"} — ${leave.type.replace(/_/g, " ")}`,
      empLeaveStatusEmailHtml({
        name:      leave.employee.name,
        type:      leave.type,
        fromDate:  new Date(leave.fromDate).toLocaleDateString("en-IN"),
        toDate:    new Date(leave.toDate).toLocaleDateString("en-IN"),
        days:      leave.days,
        status:    status as "APPROVED" | "REJECTED",
        adminNote: adminNote || null,
      })
    ).catch(() => {});
  } catch { /* non-critical */ }

  return NextResponse.json(leave);
}

// DELETE — employee cancels pending leave
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const leave = await prisma.leaveRequest.findUnique({ where: { id: params.id } });
  if (!leave) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (leave.status !== "PENDING") return NextResponse.json({ error: "Cannot cancel approved/rejected leave" }, { status: 400 });

  await prisma.leaveRequest.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
