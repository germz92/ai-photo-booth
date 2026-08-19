import { requireOwnedEvent } from "@/lib/access";
import { getEventBranding, setDocumentFields } from "@/lib/prisma";
import { contentTypeForKey, getObject, putObject } from "@/lib/storage";

export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

type LogoKind = "wall" | "overlay" | "sample";

const KIND: Record<LogoKind, { field: string; prefix: string; maxBytes: number; label: string }> = {
  wall: { field: "wallLogoKey", prefix: "wall-logo", maxBytes: 4 * 1024 * 1024, label: "logo" },
  overlay: { field: "overlayLogoKey", prefix: "overlay-logo", maxBytes: 4 * 1024 * 1024, label: "logo" },
  sample: { field: "overlaySampleKey", prefix: "overlay-sample", maxBytes: 8 * 1024 * 1024, label: "sample photo" },
};

function kindFrom(request: Request): LogoKind {
  const kind = new URL(request.url).searchParams.get("kind");
  if (kind === "overlay" || kind === "sample") return kind;
  return "wall";
}

function keyFor(kind: LogoKind, branding: Awaited<ReturnType<typeof getEventBranding>>) {
  if (kind === "overlay") return branding.overlaySourceKey;
  if (kind === "sample") return branding.overlaySampleKey;
  return branding.wallLogoKey;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedEvent(id);
  if (!access.ok) return access.response;
  const branding = await getEventBranding(id);
  const key = keyFor(kindFrom(request), branding);
  if (!key) return new Response("Not found", { status: 404 });
  try {
    const body = await getObject(key);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": contentTypeForKey(key),
        "Cache-Control": "private, max-age=30",
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
  const access = await requireOwnedEvent(id);
  if (!access.ok) return access.response;

  const kind = kindFrom(request);
  const config = KIND[kind];
  const form = await request.formData();
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: `Choose a ${config.label}` }, { status: 400 });
  }
  if (file.size > config.maxBytes) {
    return Response.json(
      { error: `${config.label} must be under ${Math.round(config.maxBytes / (1024 * 1024))}MB` },
      { status: 400 },
    );
  }
  const extension = TYPES[file.type];
  if (!extension) {
    return Response.json({ error: "Use a PNG, JPEG, or WebP image" }, { status: 400 });
  }

  const key = `events/${id}/${config.prefix}-${crypto.randomUUID()}.${extension}`;
  await putObject(key, Buffer.from(await file.arrayBuffer()), file.type);
  await setDocumentFields("Event", id, { [config.field]: key });
  return Response.json({ ok: true, hasLogo: true, kind });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedEvent(id);
  if (!access.ok) return access.response;
  const kind = kindFrom(request);
  await setDocumentFields("Event", id, { [KIND[kind].field]: "" });
  return Response.json({ ok: true, hasLogo: false, kind });
}
