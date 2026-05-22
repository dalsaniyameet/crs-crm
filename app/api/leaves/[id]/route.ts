import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

async function isAdmin(userId: string) {
  const u = await clerkClient.users.getUser(userId);
  return (u.publicMetadata?.role as string)?.toUpperCase() === "ADMIN";
}

// PATCH — admin approve/reject
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = auth();
  if (!userId || !(await isAdmin(userId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { status, adminNote } = await req.json();
  if (!["APPROVED", "REJECTED"].includes(status))
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const leave = await prisma.leaveRequest.update({
    where: { id: params.id },
    data: { status, adminNote: adminNote || null },
    include: { employee: { select: { name: true, email: true } } },
  });

  // Notify the employee
  try {
    const dbUser = await prisma.user.findUnique({ where: { email: leave.employee.email } });
    if (dbUser) {
      await prisma.notification.create({
        data: {
          userId:  dbUser.id,
          type:    "LEAVE_REQUEST",
          title:   `Leave ${status === "APPROVED" ? "Approved ✅" : "Rejected ❌"}`,
          message: `Your ${leave.type.replace("_"," ")} leave request (${new Date(leave.fromDate).toLocaleDateString("en-IN")} → ${new Date(leave.toDate).toLocaleDateString("en-IN")}) has been ${status.toLowerCase()}.${ adminNote ? ` Admin note: ${adminNote}` : ""}`,
        },
      });
    }
  } catch { /* non-critical */ }

  return NextResponse.json(leave);
}

// DELETE — employee cancels pending leave
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const leave = await prisma.leaveRequest.findUnique({ where: { id: params.id } });
  if (!leave || leave.status !== "PENDING")
    return NextResponse.json({ error: "Cannot cancel" }, { status: 400 });

  await prisma.leaveRequest.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
