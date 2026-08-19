import { requireOwnedTheme } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedTheme(id);
  if (!access.ok) return access.response;
  const body = (await request.json()) as {
    title?: string;
    prompt?: string;
    active?: boolean;
    sortOrder?: number;
  };
  const data: { title?: string; prompt?: string; active?: boolean; sortOrder?: number } = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body.prompt === "string" && body.prompt.trim()) data.prompt = body.prompt.trim();
  if (typeof body.active === "boolean") data.active = body.active;
  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
    data.sortOrder = Math.round(body.sortOrder);
  }
  try {
    const theme = await prisma.theme.update({ where: { id }, data });
    return Response.json({ theme });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedTheme(id);
  if (!access.ok) return access.response;
  const jobs = await prisma.job.count({ where: { themeId: id } });
  if (jobs > 0) {
    const theme = await prisma.theme.update({
      where: { id },
      data: { active: false },
    });
    return Response.json({ theme, deactivated: true });
  }
  try {
    await prisma.theme.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
