import { requireOwnedEvent } from "@/lib/access";
import { brandingOverlayWrite, clampOverlayLayerIndex, overlayLayerSourceKey } from "@/lib/overlay";
import { getEventBranding, setDocumentFields } from "@/lib/prisma";
import { contentTypeForKey, getObject, putObject } from "@/lib/storage";

export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

type LogoKind = "wall" | "overlay" | "sample";

const KIND: Record<LogoKind, { prefix: string; maxBytes: number; label: string }> = {
  wall: { prefix: "wall-logo", maxBytes: 4 * 1024 * 1024, label: "logo" },
  overlay: { prefix: "overlay-logo", maxBytes: 4 * 1024 * 1024, label: "logo" },
  sample: { prefix: "overlay-sample", maxBytes: 8 * 1024 * 1024, label: "sample photo" },
};

function kindFrom(request: Request): LogoKind {
  const kind = new URL(request.url).searchParams.get("kind");
  if (kind === "overlay" || kind === "sample") return kind;
  return "wall";
}

function layerFrom(request: Request) {
  const raw = new URL(request.url).searchParams.get("layer");
  if (raw == null || raw === "") return 0;
  return clampOverlayLayerIndex(Number(raw) - 1);
}

function keyFor(
  kind: LogoKind,
  layer: number,
  branding: Awaited<ReturnType<typeof getEventBranding>>,
) {
  if (kind === "overlay") return overlayLayerSourceKey(branding.overlayLayers[layer], layer, branding.wallLogoKey);
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
  const kind = kindFrom(request);
  const layer = kind === "overlay" ? layerFrom(request) : 0;
  const key = keyFor(kind, layer, branding);
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
  const layer = kind === "overlay" ? layerFrom(request) : 0;
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

  const suffix = kind === "overlay" ? `-${layer + 1}` : "";
  const key = `events/${id}/${config.prefix}${suffix}-${crypto.randomUUID()}.${extension}`;
  await putObject(key, Buffer.from(await file.arrayBuffer()), file.type);
  if (kind === "overlay") {
    const branding = await getEventBranding(id);
    const layers = branding.overlayLayers.map((item, index) =>
      index === layer ? { ...item, logoKey: key } : item,
    );
    await setDocumentFields("Event", id, brandingOverlayWrite(layers));
  } else if (kind === "sample") {
    await setDocumentFields("Event", id, { overlaySampleKey: key });
  } else {
    await setDocumentFields("Event", id, { wallLogoKey: key });
  }
  return Response.json({ ok: true, hasLogo: true, kind, layer: layer + 1 });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedEvent(id);
  if (!access.ok) return access.response;
  const kind = kindFrom(request);
  const layer = kind === "overlay" ? layerFrom(request) : 0;
  if (kind === "overlay") {
    const branding = await getEventBranding(id);
    const layers = branding.overlayLayers.map((item, index) =>
      index === layer ? { ...item, logoKey: "" } : item,
    );
    await setDocumentFields("Event", id, brandingOverlayWrite(layers));
  } else if (kind === "sample") {
    await setDocumentFields("Event", id, { overlaySampleKey: "" });
  } else {
    await setDocumentFields("Event", id, { wallLogoKey: "" });
  }
  return Response.json({ ok: true, hasLogo: false, kind, layer: layer + 1 });
}
