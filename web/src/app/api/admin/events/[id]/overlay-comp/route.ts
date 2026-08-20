import { requireOwnedEvent } from "@/lib/access";
import { applyLogoOverlay } from "@/lib/overlay-apply";
import { clampOverlayAxis, clampOverlayScale } from "@/lib/overlay";
import { getEventBranding } from "@/lib/prisma";
import { getObject } from "@/lib/storage";

export const runtime = "nodejs";

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
  if (!branding.overlaySourceKey) {
    return Response.json({ error: "Upload an overlay logo first." }, { status: 400 });
  }

  const url = new URL(request.url);
  const scale = clampOverlayScale(url.searchParams.get("scale") ?? branding.overlayScale);
  const x = clampOverlayAxis(url.searchParams.get("x") ?? branding.overlayX, 0.5);
  const y = clampOverlayAxis(url.searchParams.get("y") ?? branding.overlayY, 0.045);

  try {
    const [sample, logo] = await Promise.all([
      getObject(branding.overlaySampleKey),
      getObject(branding.overlaySourceKey),
    ]);
    const buffer = await applyLogoOverlay(sample, logo, {
      x,
      y,
      scale,
      contentType: "image/jpeg",
    });
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": 'attachment; filename="overlay-comp.jpg"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "Could not composite the overlay." }, { status: 500 });
  }
}
