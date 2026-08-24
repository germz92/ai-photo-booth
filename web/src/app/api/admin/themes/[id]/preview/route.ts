import { requireOwnedJob, requireOwnedTheme } from "@/lib/access";
import { jobOutputKeys } from "@/lib/jobs";
import { getDocument, prisma, setDocumentFields } from "@/lib/prisma";
import { contentTypeForKey, getObject, putObject } from "@/lib/storage";
import {
  isPreviewKind,
  parseThemePreviews,
  previewFieldFor,
  previewKeyFor,
  themePreviewFlags,
  type PreviewKind,
} from "@/lib/theme-previews";
import sharp from "sharp";

export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function kindFrom(request: Request): PreviewKind {
  const kind = new URL(request.url).searchParams.get("kind");
  return isPreviewKind(kind) ? kind : "main";
}

async function previewJpeg(buffer: Buffer) {
  return sharp(buffer)
    .rotate()
    .resize(960, 1408, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

async function savePreview(themeId: string, kind: PreviewKind, buffer: Buffer) {
  const jpeg = await previewJpeg(buffer);
  const key = `themes/${themeId}/preview-${kind}-${crypto.randomUUID()}.jpg`;
  await putObject(key, jpeg, "image/jpeg");
  await setDocumentFields("Theme", themeId, { [previewFieldFor(kind)]: key });
  const previews = parseThemePreviews(await getDocument("Theme", themeId));
  return { ok: true, kind, ...themePreviewFlags(previews) };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedTheme(id);
  if (!access.ok) return access.response;
  const kind = kindFrom(request);
  const previews = parseThemePreviews(await getDocument("Theme", id));
  const key = previewKeyFor(previews, kind);
  if (!key) return new Response("Not found", { status: 404 });
  try {
    const body = await getObject(key);
    const versioned = new URL(request.url).searchParams.has("v");
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": contentTypeForKey(key),
        "Cache-Control": versioned ? "private, max-age=86400, immutable" : "no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedTheme(id);
  if (!access.ok) return access.response;
  const kind = kindFrom(request);

  const form = await request.formData();
  const file = form.get("image");
  const jobId = String(form.get("jobId") || "").trim();
  const index = Number(form.get("index") || "0");

  if (jobId) {
    const jobAccess = await requireOwnedJob(jobId);
    if (!jobAccess.ok) return jobAccess.response;
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { eventId: true, outputKey: true, outputKeys: true, status: true },
    });
    if (!job || job.eventId !== access.theme.eventId || job.status !== "complete") {
      return Response.json({ error: "Portrait is not available" }, { status: 400 });
    }
    const key = jobOutputKeys(job)[Number.isFinite(index) ? index : 0];
    if (!key) return Response.json({ error: "Portrait is not available" }, { status: 400 });
    try {
      return Response.json(await savePreview(id, kind, await getObject(key)));
    } catch {
      return Response.json({ error: "Could not copy that portrait" }, { status: 500 });
    }
  }

  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Choose a preview image or a portrait" }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return Response.json({ error: "Preview must be under 8MB" }, { status: 400 });
  }
  if (!TYPES[file.type]) {
    return Response.json({ error: "Use a PNG, JPEG, or WebP image" }, { status: 400 });
  }
  try {
    return Response.json(await savePreview(id, kind, Buffer.from(await file.arrayBuffer())));
  } catch {
    return Response.json({ error: "Could not save preview" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedTheme(id);
  if (!access.ok) return access.response;
  const kind = kindFrom(request);
  await setDocumentFields("Theme", id, { [previewFieldFor(kind)]: "" });
  const previews = parseThemePreviews(await getDocument("Theme", id));
  return Response.json({ ok: true, kind, ...themePreviewFlags(previews) });
}
