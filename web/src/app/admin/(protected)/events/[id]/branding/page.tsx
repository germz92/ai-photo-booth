import { getEventBranding } from "@/lib/prisma";
import { EventBranding } from "../EventBranding";
import { loadAdminEvent } from "../load-event";

export default async function EventBrandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await loadAdminEvent(id);
  const branding = await getEventBranding(event.id);

  return (
    <EventBranding
      eventId={event.id}
      eventName={event.name}
      initial={{
        wallTitle: branding.wallTitle,
        showWallTitle: branding.showWallTitle,
        hasLogo: Boolean(branding.wallLogoKey),
        overlayEnabled: branding.overlayEnabled,
        hasOverlayLogo: Boolean(branding.overlayLogoKey),
        overlayScale: branding.overlayScale,
        overlayX: branding.overlayX,
        overlayY: branding.overlayY,
        hasOverlaySample: Boolean(branding.overlaySampleKey),
      }}
    />
  );
}
