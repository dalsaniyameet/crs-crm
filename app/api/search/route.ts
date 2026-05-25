import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: {} });

  const results: Record<string, unknown> = {};

  const [leads, properties, deals, owners, visits, employees, agreements] = await Promise.all([
    prisma.lead.findMany({
      where: { OR: [
        { name:         { contains: q, mode: "insensitive" } },
        { phone:        { contains: q } },
        { email:        { contains: q, mode: "insensitive" } },
        { requirements: { contains: q, mode: "insensitive" } },
        { notes:        { contains: q, mode: "insensitive" } },
      ]},
      select: { id: true, name: true, phone: true, status: true, source: true },
      take: 5,
    }),
    prisma.property.findMany({
      where: { OR: [
        { title:       { contains: q, mode: "insensitive" } },
        { locality:    { contains: q, mode: "insensitive" } },
        { city:        { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { ownerName:   { contains: q, mode: "insensitive" } },
        { ownerPhone:  { contains: q } },
        { address:     { contains: q, mode: "insensitive" } },
      ]},
      select: { id: true, title: true, locality: true, price: true, type: true, status: true, category: true },
      take: 5,
    }),
    prisma.deal.findMany({
      where: { OR: [
        { title: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { lead:  { name:  { contains: q, mode: "insensitive" } } },
        { lead:  { phone: { contains: q } } },
        { property: { title:    { contains: q, mode: "insensitive" } } },
        { property: { locality: { contains: q, mode: "insensitive" } } },
      ]},
      select: { id: true, title: true, stage: true, value: true, lead: { select: { name: true } } },
      take: 5,
    }),
    prisma.propertyOwner.findMany({
      where: { OR: [
        { name:    { contains: q, mode: "insensitive" } },
        { phone:   { contains: q } },
        { phone2:  { contains: q } },
        { email:   { contains: q, mode: "insensitive" } },
        { company: { contains: q, mode: "insensitive" } },
        { locality:{ contains: q, mode: "insensitive" } },
      ]},
      select: { id: true, name: true, phone: true, company: true, locality: true },
      take: 5,
    }),
    prisma.siteVisit.findMany({
      where: { OR: [
        { lead:     { name:  { contains: q, mode: "insensitive" } } },
        { lead:     { phone: { contains: q } } },
        { property: { title:    { contains: q, mode: "insensitive" } } },
        { property: { locality: { contains: q, mode: "insensitive" } } },
        { notes:    { contains: q, mode: "insensitive" } },
      ]},
      select: { id: true, status: true, scheduledAt: true, lead: { select: { name: true } }, property: { select: { title: true } } },
      take: 5,
    }),
    prisma.employeeProfile.findMany({
      where: { OR: [
        { name:     { contains: q, mode: "insensitive" } },
        { email:    { contains: q, mode: "insensitive" } },
        { position: { contains: q, mode: "insensitive" } },
      ]},
      select: { id: true, name: true, email: true, position: true, role: true },
      take: 5,
    }),
    prisma.agreement.findMany({
      where: { OR: [
        { title:       { contains: q, mode: "insensitive" } },
        { client:      { contains: q, mode: "insensitive" } },
        { clientPhone: { contains: q } },
        { property:    { contains: q, mode: "insensitive" } },
        { broker:      { contains: q, mode: "insensitive" } },
      ]},
      select: { id: true, title: true, client: true, type: true, status: true },
      take: 5,
    }),
  ]);

  if (leads.length)       results.leads       = leads;
  if (properties.length)  results.properties  = properties;
  if (deals.length)       results.deals       = deals;
  if (owners.length)      results.owners      = owners;
  if (visits.length)      results.visits      = visits;
  if (employees.length)   results.employees   = employees;
  if (agreements.length)  results.agreements  = agreements;

  return NextResponse.json({ results, query: q });
}
