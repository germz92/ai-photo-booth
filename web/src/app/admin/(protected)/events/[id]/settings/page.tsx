import { getEventCaptureKiosk, publicCaptureKiosk } from "@/lib/capture-kiosk";
import { getEventBranding } from "@/lib/prisma";
import { EventSettingsHub } from "../EventSettingsHub";
import { loadAdminEvent } from "../load-event";

export const dynamic = "force-dynamic";

export default async function EventSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const event = await loadAdminEvent(id);
  const [branding, capture] = await Promise.all([
    getEventBranding(event.id),
    getEventCaptureKiosk(event.id),
  ]);

  return (
    <EventSettingsHub
      eventId={event.id}
      initialTab={tab}
      initialEvent={{
        id: event.id,
        name: event.name,
        status: event.status,
        batch: Number((event as { batch?: number }).batch) || 1,
        allowUpload: branding.allowUpload,
        eventDate: event.eventDate.toISOString(),
        themes: event.themes,
      }}
      initialCapture={publicCaptureKiosk(capture, { includePin: true })}
      initialBranding={{
        wallTitle: branding.wallTitle,
        showWallTitle: branding.showWallTitle,
        hasLogo: Boolean(branding.wallLogoKey),
        overlayEnabled: branding.overlayEnabled,
        hasOverlayLogo: Boolean(branding.overlayLogoKey),
        overlayScale: branding.overlayScale,
        overlayX: branding.overlayX,
        overlayY: branding.overlayY,
        overlayLayers: branding.overlayLayers.map((layer, index) => ({
          hasLogo: Boolean(layer.logoKey),
          usesWallLogo: index === 0 && !layer.logoKey && Boolean(branding.wallLogoKey),
          scale: layer.scale,
          x: layer.x,
          y: layer.y,
          dropShadow: layer.dropShadow,
          shadow: layer.shadow,
        })),
        hasOverlaySample: Boolean(branding.overlaySampleKey),
      }}
    />
  );
}
