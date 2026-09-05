import { requireOwnedEvent } from "@/lib/access";
import { applyLogoOverlays } from "@/lib/overlay-apply";
import { clampOverlayAxis, clampOverlayScale, clampOverlayShadow, overlayLayerSourceKey } from "@/lib/overlay";
import { getEventBranding } from "@/lib/prisma";
import { getObject } from "@/lib/storage";

export const runtime = "nodejs";

function layerParam(url: URL, index: number, name: "scale" | "x" | "y", fallback: number) {
  const key = index === 0 ? name : `${name}${index + 1}`;
  const raw = url.searchParams.get(key);
  if (name === "scale") return clampOverlayScale(raw ?? fallback);
  return clampOverlayAxis(raw ?? fallback, name === "x" ? 0.5 : 0.045);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedEvent(id);
  if (!access.ok) return access.response;

  const branding = await getEventBranding(id);
  if (!branding.overlaySampleKey) {
    return Response.json({ error: "Upload a sample photo first." }, { status: 400 });
  }

  const url = new URL(request.url);
  const stamps = (
    await Promise.all(
      branding.overlayLayers.map(async (layer, index) => {
        const key = overlayLayerSourceKey(layer, index, branding.wallLogoKey);
        if (!key) return null;
        const suffix = index === 0 ? "" : String(index + 1);
        return {
          buffer: await getObject(key),
          scale: layerParam(url, index, "scale", layer.scale),
          x: layerParam(url, index, "x", layer.x),
          y: layerParam(url, index, "y", layer.y),
          dropShadow: (url.searchParams.get(`shadow${suffix}`) ?? (layer.dropShadow ? "1" : "0")) === "1",
          shadow: clampOverlayShadow(url.searchParams.get(`shadowAmt${suffix}`) ?? layer.shadow),
        };
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (!stamps.length) {
    return Response.json({ error: "Upload an overlay logo first." }, { status: 400 });
  }

  try {
    const sample = await getObject(branding.overlaySampleKey);
    const buffer = await applyLogoOverlays(sample, stamps, "image/jpeg");
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": 'attachment; filename="overlay-comp.jpg"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Overlay comp failed", error);
    const message = error instanceof Error ? error.message : "Could not composite the overlay.";
    return Response.json({ error: message }, { status: 500 });
  }
}
