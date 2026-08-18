import { deliverJob } from "@/lib/delivery";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  if (job.status !== "complete") {
    return Response.json({ error: "Job is not complete" }, { status: 409 });
  }

  let channels: Array<"email" | "sms"> | undefined;
  try {
    const body = (await request.json()) as { channels?: Array<"email" | "sms"> };
    channels = body.channels;
  } catch {
    channels = undefined;
  }

  const updated = await deliverJob(id, { force: true, channels });
  return Response.json({
    id: updated?.id,
    emailStatus: updated?.emailStatus,
    smsStatus: updated?.smsStatus,
    emailError: updated?.emailError,
    smsError: updated?.smsError,
  });
}
