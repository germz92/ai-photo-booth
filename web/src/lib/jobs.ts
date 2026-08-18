import { prisma } from "./prisma";
import { deliverJob } from "./delivery";
import { decodeRunpodImage, type RunpodWebhookPayload } from "./runpod";
import { getObject, putObject } from "./storage";

const RESULT_TTL_MS = 48 * 60 * 60 * 1000;

export function resultExpiry(now = Date.now()) {
  return new Date(now + RESULT_TTL_MS);
}

export function linkExpired(expiresAt: Date, now = Date.now()) {
  return expiresAt.getTime() < now;
}

export async function completeJobFromOutput(options: {
  jobId: string;
  buffer: Buffer;
  contentType: string;
}) {
  const outputKey = `outputs/${options.jobId}${extensionFor(options.contentType)}`;
  await putObject(outputKey, options.buffer, options.contentType);
  await prisma.job.update({
    where: { id: options.jobId },
    data: { status: "complete", outputKey, error: null },
  });
  await deliverJob(options.jobId);
}

export async function completeMockJob(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;
  const original = await getObject(job.originalKey);
  await completeJobFromOutput({
    jobId,
    buffer: original,
    contentType: "image/jpeg",
  });
}

export async function handleRunpodWebhook(payload: RunpodWebhookPayload) {
  if (!payload.id) throw new Error("Webhook missing job id");

  const job = await prisma.job.findUnique({
    where: { runpodJobId: payload.id },
  });
  if (!job) {
    throw new Error(`No booth job for RunPod id ${payload.id}`);
  }

  const status = payload.status || "";

  if (status === "IN_QUEUE" || status === "IN_PROGRESS") {
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "processing" },
    });
    return { ok: true, jobId: job.id, status: "processing" };
  }

  if (status === "FAILED" || status === "CANCELLED" || status === "TIMED_OUT") {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: payload.error || status,
      },
    });
    return { ok: true, jobId: job.id, status: "failed" };
  }

  if (status !== "COMPLETED") {
    return { ok: true, jobId: job.id, status: job.status };
  }

  const image = payload.output?.images?.[0];
  if (!image) {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: payload.output?.errors?.join("; ") || "No images in RunPod output",
      },
    });
    return { ok: true, jobId: job.id, status: "failed" };
  }

  const decoded = await decodeRunpodImage(image);
  await completeJobFromOutput({
    jobId: job.id,
    buffer: decoded.buffer,
    contentType: decoded.contentType,
  });
  return { ok: true, jobId: job.id, status: "complete" };
}

function extensionFor(contentType: string) {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  if (contentType.includes("webp")) return ".webp";
  return ".png";
}
