import { requireOwnedJob } from "@/lib/access";
import { jobOutputKeys } from "@/lib/jobs";
import { resultLink } from "@/lib/delivery";
import { prisma } from "@/lib/prisma";
import { attachThemeLooks } from "@/lib/theme-looks-db";
import { getJobManualUpload, getJobName, setJobName } from "@/lib/job-name";
import { parseJobContact } from "@/lib/validate";
import { clampBatch } from "@/lib/workflow";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedJob(id);
  if (!access.ok) return access.response;
  const job = await prisma.job.findUnique({
    where: { id },
    include: { theme: { select: { title: true, prompt: true } } },
  });
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  const prompt =
    (typeof (job as { prompt?: string }).prompt === "string" && (job as { prompt?: string }).prompt) ||
    job.theme.prompt;
  const themeRows = await prisma.theme.findMany({
    where: {
      eventId: job.eventId,
      OR: [{ active: true }, { id: job.themeId }],
    },
    orderBy: { sortOrder: "asc" },
    select: { id: true, title: true, prompt: true, active: true },
  });
  const themes = (await attachThemeLooks(themeRows)).map((theme) => ({
    id: theme.id,
    title: theme.title,
    prompt: theme.prompt,
    active: theme.active,
    splitLooks: theme.splitLooks,
    masculinePrompt: theme.masculinePrompt,
    femininePrompt: theme.femininePrompt,
  }));
  return Response.json({
    job: {
      id: job.id,
      status: job.status,
      name: await getJobName(job.id, job.name),
      manualUpload: await getJobManualUpload(job.id),
      email: job.email,
      phone: job.phone,
      prompt,
      batch: Number((job as { batch?: number }).batch) || 1,
      eventId: job.eventId,
      themeId: job.themeId,
      themeTitle: job.theme.title,
      emailStatus: job.emailStatus,
      smsStatus: job.smsStatus,
      emailError: job.emailError,
      smsError: job.smsError,
      error: job.error,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      hasOriginal: Boolean(job.originalKey),
      outputCount: jobOutputKeys(job).length,
      resultUrl: resultLink(job.resultToken),
      resultExpiresAt: job.resultExpiresAt.toISOString(),
      themes,
    },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedJob(id);
  if (!access.ok) return access.response;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json()) as {
    name?: string;
    email?: string;
    phone?: string;
    prompt?: string;
    batch?: number;
    themeId?: string;
  };

  const contact = parseJobContact(
    body.email !== undefined ? body.email : job.email,
    body.phone !== undefined ? body.phone : job.phone,
    {
      required: false,
      name: body.name !== undefined ? body.name : await getJobName(job.id, job.name),
    },
  );
  if ("error" in contact) {
    return Response.json({ error: contact.error }, { status: 400 });
  }

  const prompt =
    body.prompt !== undefined
      ? body.prompt.trim()
      : ((job as { prompt?: string }).prompt || "");
  const batch =
    body.batch !== undefined
      ? clampBatch(body.batch, Number((job as { batch?: number }).batch) || 1)
      : Number((job as { batch?: number }).batch) || 1;

  let themeId = job.themeId;
  if (body.themeId && body.themeId !== job.themeId) {
    const theme = await prisma.theme.findFirst({
      where: { id: body.themeId, eventId: job.eventId },
      select: { id: true },
    });
    if (!theme) return Response.json({ error: "Theme is not available" }, { status: 400 });
    themeId = theme.id;
  }

  try {
    const updated = await prisma.job.update({
      where: { id },
      data: {
        email: contact.email,
        phone: contact.phone,
        prompt,
        batch,
        themeId,
        emailStatus: contact.email ? (contact.email === job.email ? job.emailStatus : "pending") : "skipped",
        smsStatus: contact.phone ? (contact.phone === job.phone ? job.smsStatus : "pending") : "skipped",
        emailError: contact.email === job.email ? job.emailError : null,
        smsError: contact.phone === job.phone ? job.smsError : null,
      },
    });
    await setJobName(id, contact.name);
    return Response.json({
      job: {
        id: updated.id,
        name: contact.name,
        email: updated.email,
        phone: updated.phone,
        prompt: (updated as { prompt?: string }).prompt ?? prompt,
        batch: Number((updated as { batch?: number }).batch) || batch,
        themeId: updated.themeId,
        emailStatus: updated.emailStatus,
        smsStatus: updated.smsStatus,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}

