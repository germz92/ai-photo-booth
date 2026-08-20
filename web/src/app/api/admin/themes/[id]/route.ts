import { requireOwnedTheme } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { attachThemeLooks, saveThemeLooks } from "@/lib/theme-looks-db";
import { validateThemeLooksInput } from "@/lib/theme-looks";

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
    splitLooks?: boolean;
    masculinePrompt?: string;
    femininePrompt?: string;
    active?: boolean;
    sortOrder?: number;
  };
  const data: { title?: string; prompt?: string; active?: boolean; sortOrder?: number } = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body.active === "boolean") data.active = body.active;
  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
    data.sortOrder = Math.round(body.sortOrder);
  }
  const looksTouched =
    typeof body.splitLooks === "boolean" ||
    typeof body.prompt === "string" ||
    typeof body.masculinePrompt === "string" ||
    typeof body.femininePrompt === "string";
  let parsedLooks: ReturnType<typeof validateThemeLooksInput> | null = null;
  if (looksTouched) {
    parsedLooks = validateThemeLooksInput(body);
    if ("error" in parsedLooks) {
      return Response.json({ error: parsedLooks.error }, { status: 400 });
    }
    data.prompt = parsedLooks.prompt;
  }
  try {
    const theme = await prisma.theme.update({ where: { id }, data });
    if (parsedLooks && !("error" in parsedLooks)) {
      await saveThemeLooks(id, parsedLooks.looks);
    }
    const [withLooks] = await attachThemeLooks([theme]);
    return Response.json({ theme: withLooks });
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
