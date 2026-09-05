import { deliverJob } from "./delivery";
import { overlayLayerSourceKey } from "./overlay";
import { applyLogoOverlays } from "./overlay-apply";
import { getEventBranding, prisma } from "./prisma";
import {
  decodeRunpodImage,
  getRunpodJobStatus,
  mockRunpod,
  submitRunpodJob,
  type RunpodWebhookPayload,
} from "./runpod";
import { getObject, putObject } from "./storage";
import { loadThemeLooks, resolveJobKreaPrompt } from "./theme-looks-db";
import { isLookId, resolveThemePrompt } from "./theme-looks";
import { outputThumbKey, saveThumb } from "./thumbs";
import { clampBatch } from "./workflow";

const RESULT_TTL_MS = 48 * 60 * 60 * 1000;

export function jobOutputKeys(job: { outputKey?: string | null; outputKeys?: string[] | null }) {
  if (job.outputKeys?.length) return job.outputKeys;
  return job.outputKey ? [job.outputKey] : [];
}

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
  await completeJobFromOutputs({
    jobId: options.jobId,
    images: [{ buffer: options.buffer, contentType: options.contentType }],
  });
}

export async function completeJobFromOutputs(options: {
  jobId: string;
  images: Array<{ buffer: Buffer; contentType: string }>;
  deliver?: boolean;
}) {
  const existing = await prisma.job.findUnique({ where: { id: options.jobId } });
  if (!existing || existing.status === "complete") return;
  if (!options.images.length) return;

  const images = await overlayJobImages(existing.eventId, options.images);

  const outputKeys = images.map(
    (image, index) => `outputs/${options.jobId}-${index}${extensionFor(image.contentType)}`,
  );

  await Promise.all(
    images.map((image, index) =>
      putObject(outputKeys[index], image.buffer, image.contentType),
    ),
  );

  const updated = await prisma.job.updateMany({
    where: { id: options.jobId, status: { not: "complete" } },
    data: { status: "complete", outputKey: outputKeys[0], outputKeys, error: null },
  });
  if (updated.count === 0) return;

  const thumbs = Promise.all(
    images.map(async (image, index) => {
      try {
        await saveThumb(outputThumbKey(options.jobId, index), image.buffer);
      } catch (error) {
        console.error("Output thumb failed", error);
      }
    }),
  );

  if (options.deliver === false) {
    await thumbs;
    return;
  }

  await Promise.all([thumbs, deliverJob(options.jobId)]);
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

export async function regenerateJob(
  jobId: string,
  options?: { prompt?: string; batch?: number; themeId?: string; look?: string },
) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { theme: { select: { prompt: true } }, event: { select: { batch: true } } },
  });
  if (!job) throw new Error("Not found");

  let themeId = job.themeId;
  let themePrompt = job.theme.prompt;
  if (options?.themeId && options.themeId !== job.themeId) {
    const theme = await prisma.theme.findFirst({
      where: { id: options.themeId, eventId: job.eventId },
      select: { id: true, prompt: true },
    });
    if (!theme) throw new Error("Theme is not available");
    themeId = theme.id;
    themePrompt = theme.prompt;
  }

  const looks = await loadThemeLooks(themeId, themePrompt);
  const look = isLookId(options?.look) ? options.look : undefined;
  const customPrompt = options?.prompt?.trim() || "";
  const prompt = customPrompt || resolveThemePrompt(looks, themePrompt, look) || (job.prompt || "").trim();
  if (!prompt) {
    throw new Error(looks.splitLooks && !look ? "Please choose a look" : "Prompt is required");
  }
  const kreaPrompt = await resolveJobKreaPrompt({
    themeId,
    themePrompt,
    looks,
    qwenPrompt: prompt,
    look,
    convertIfCustom: true,
  });
  const batch = clampBatch(options?.batch ?? job.batch ?? job.event.batch, 1);
  const original = await getObject(job.originalKey);

  await prisma.job.update({
    where: { id: jobId },
    data: {
      themeId,
      prompt,
      batch,
      status: "submitted",
      error: null,
      runpodJobId: null,
    },
  });

  const submitted = await submitRunpodJob({
    imageBase64: original.toString("base64"),
    qwenPrompt: prompt,
    kreaPrompt,
    batch,
  });

  await prisma.job.update({
    where: { id: jobId },
    data: {
      runpodJobId: submitted.id,
      kreaSeed: String(submitted.kreaSeed),
      qwenSeed: String(submitted.qwenSeed),
      status: submitted.mocked ? "processing" : "submitted",
    },
  });

  return { mocked: submitted.mocked || mockRunpod() };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function bufferFromStatusUrl(url: string) {
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid RunPod data URL");
    return { contentType: match[1], buffer: Buffer.from(match[2], "base64") };
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download output (${response.status})`);
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "image/png",
  };
}

function pollDelay(status?: string) {
  if (status === "IN_PROGRESS") return 1000;
  if (status === "IN_QUEUE") return 2000;
  return 1500;
}

export async function pollRunpodUntilDone(jobId: string) {
  const deadline = Date.now() + 12 * 60 * 1000;
  let delay = 1500;

  while (Date.now() < deadline) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job?.runpodJobId || job.runpodJobId.startsWith("mock_")) return;
    if (job.status === "complete" || job.status === "failed") return;

    try {
      const status = await getRunpodJobStatus(job.runpodJobId);
      delay = pollDelay(status.status);
      if (status.status === "IN_QUEUE" || status.status === "IN_PROGRESS") {
        if (job.status !== "processing") {
          await prisma.job.update({
            where: { id: jobId },
            data: { status: "processing" },
          });
        }
      } else if (status.status === "COMPLETED") {
        if (!status.images.length) {
          await prisma.job.update({
            where: { id: jobId },
            data: {
              status: "failed",
              error: status.error || "No images in RunPod output",
            },
          });
          return;
        }
        const images = await Promise.all(
          status.images.map((image) => bufferFromStatusUrl(image.url)),
        );
        await completeJobFromOutputs({ jobId, images });
        return;
      } else if (
        status.status === "FAILED" ||
        status.status === "CANCELLED" ||
        status.status === "TIMED_OUT"
      ) {
        await prisma.job.update({
          where: { id: jobId },
          data: { status: "failed", error: status.error || status.status },
        });
        return;
      }
    } catch (error) {
      console.error("RunPod poll error", error);
      delay = 2500;
    }

    await sleep(delay);
  }
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

  const images = payload.output?.images ?? [];
  if (!images.length) {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: payload.output?.errors?.join("; ") || "No images in RunPod output",
      },
    });
    return { ok: true, jobId: job.id, status: "failed" };
  }

  const decoded = await Promise.all(images.map((image) => decodeRunpodImage(image)));
  await completeJobFromOutputs({ jobId: job.id, images: decoded, deliver: false });
  return { ok: true, jobId: job.id, status: "complete" };
}

function extensionFor(contentType: string) {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  if (contentType.includes("webp")) return ".webp";
  return ".png";
}

async function overlayJobImages(
  eventId: string,
  images: Array<{ buffer: Buffer; contentType: string }>,
) {
  try {
    const branding = await getEventBranding(eventId);
    if (!branding.overlayEnabled) return images;
    const stamps = (
      await Promise.all(
        branding.overlayLayers.map(async (layer, index) => {
          const key = overlayLayerSourceKey(layer, index, branding.wallLogoKey);
          if (!key) return null;
          return {
            buffer: await getObject(key),
            x: layer.x,
            y: layer.y,
            scale: layer.scale,
            dropShadow: layer.dropShadow,
            shadow: layer.shadow,
            stroke: layer.stroke,
            strokeWidth: layer.strokeWidth,
            strokeColor: layer.strokeColor,
            strokeOpacity: layer.strokeOpacity,
          };
        }),
      )
    ).filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (!stamps.length) return images;
    return await Promise.all(
      images.map(async (image) => ({
        contentType: image.contentType,
        buffer: await applyLogoOverlays(image.buffer, stamps, image.contentType),
      })),
    );
  } catch (error) {
    console.error("Logo overlay failed", error);
    return images;
  }
}
