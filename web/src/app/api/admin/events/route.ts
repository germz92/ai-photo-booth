import { unauthorized } from "@/lib/admin";
import { listOwnedEventIds, requireUser, setEventOwner } from "@/lib/access";
import { prisma, setDocumentFields } from "@/lib/prisma";
import { clampBatch } from "@/lib/workflow";

export const runtime = "nodejs";

export async function GET() {
  const session = await requireUser();
  if (!session) return unauthorized();
  const ids = await listOwnedEventIds(session.user.id);
  const events = ids.length
    ? await prisma.event.findMany({
        where: { id: { in: ids } },
        orderBy: { eventDate: "desc" },
        include: { _count: { select: { themes: true, jobs: true } } },
      })
    : [];
  return Response.json({ events });
}

export async function POST(request: Request) {
  const session = await requireUser();
  if (!session) return unauthorized();
  const body = (await request.json()) as {
    name?: string;
    eventDate?: string;
    status?: string;
    batch?: number;
  };
  const name = String(body.name || "").trim();
  if (!name) return Response.json({ error: "Name is required" }, { status: 400 });
  const eventDate = body.eventDate ? new Date(`${body.eventDate}T12:00:00.000Z`) : new Date();
  if (Number.isNaN(eventDate.getTime())) {
    return Response.json({ error: "Invalid date" }, { status: 400 });
  }
  const status = ["draft", "live", "archived"].includes(String(body.status))
    ? String(body.status)
    : "draft";
  const batch = clampBatch(body.batch, 1);
  const event = await prisma.event.create({
    data: { name, eventDate, status, batch },
  });
  await setEventOwner(event.id, session.user.id);
  await setDocumentFields("Event", event.id, { allowUpload: false });
  return Response.json({ event });
}
