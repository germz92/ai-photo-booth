import { requireOwnedEvent } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedEvent(id);
  if (!access.ok) return access.response;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return Response.json({ error: "Event not found" }, { status: 404 });

  const body = (await request.json()) as { title?: string; prompt?: string };
  const title = String(body.title || "").trim();
  const prompt = String(body.prompt || "").trim();
  if (!title) return Response.json({ error: "Title is required" }, { status: 400 });
  if (!prompt) return Response.json({ error: "Prompt is required" }, { status: 400 });

  const last = await prisma.theme.findFirst({
    where: { eventId: id },
    orderBy: { sortOrder: "desc" },
  });
  const theme = await prisma.theme.create({
    data: {
      eventId: id,
      title,
      prompt,
      sortOrder: (last?.sortOrder ?? -1) + 1,
      active: true,
    },
  });
  return Response.json({ theme });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedEvent(id);
  if (!access.ok) return access.response;
  const body = (await request.json()) as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids.filter((value) => typeof value === "string") : [];
  if (ids.length === 0) {
    return Response.json({ error: "Theme order is required" }, { status: 400 });
  }

  const themes = await prisma.theme.findMany({ where: { eventId: id }, select: { id: true } });
  const allowed = new Set(themes.map((theme) => theme.id));
  if (ids.length !== allowed.size || ids.some((themeId) => !allowed.has(themeId))) {
    return Response.json({ error: "Theme order does not match this event" }, { status: 400 });
  }

  await Promise.all(
    ids.map((themeId, index) =>
      prisma.theme.update({ where: { id: themeId }, data: { sortOrder: index } }),
    ),
  );
  return Response.json({ ok: true });
}
