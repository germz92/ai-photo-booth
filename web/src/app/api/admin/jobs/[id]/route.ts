import { requireOwnedJob } from "@/lib/access";
import { jobOutputKeys } from "@/lib/jobs";
import { resultLink } from "@/lib/delivery";
import { prisma } from "@/lib/prisma";
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
  return Response.json({
    job: {
      id: job.id,
      status: job.status,
      email: job.email,
      phone: job.phone,
      prompt,
      batch: Number((job as { batch?: number }).batch) || 1,
      themeId: job.themeId,
      themeTitle: job.theme.title,
      emailStatus: job.emailStatus,
      smsStatus: job.smsStatus,
      emailError: job.emailError,
      smsError: job.smsError,
      error: job.error,
      createdAt: job.createdAt.toISOString(),
      hasOriginal: Boolean(job.originalKey),
      outputCount: jobOutputKeys(job).length,
      resultUrl: resultLink(job.resultToken),
      resultExpiresAt: job.resultExpiresAt.toISOString(),
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
    email?: string;
    phone?: string;
    prompt?: string;
    batch?: number;
  };

  const contact = parseJobContact(
    body.email !== undefined ? body.email : job.email,
    body.phone !== undefined ? body.phone : job.phone,
    { required: false },
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

  try {
    const updated = await prisma.job.update({
      where: { id },
      data: {
        email: contact.email,
        phone: contact.phone,
        prompt,
        batch,
        emailStatus: contact.email ? (contact.email === job.email ? job.emailStatus : "pending") : "skipped",
        smsStatus: contact.phone ? (contact.phone === job.phone ? job.smsStatus : "pending") : "skipped",
        emailError: contact.email === job.email ? job.emailError : null,
        smsError: contact.phone === job.phone ? job.smsError : null,
      },
    });
    return Response.json({
      job: {
        id: updated.id,
        email: updated.email,
        phone: updated.phone,
        prompt: (updated as { prompt?: string }).prompt ?? prompt,
        batch: Number((updated as { batch?: number }).batch) || batch,
        emailStatus: updated.emailStatus,
        smsStatus: updated.smsStatus,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}

