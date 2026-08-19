import { getEventBranding } from "@/lib/prisma";
import { EventSettings } from "../EventSettings";
import { loadAdminEvent } from "../load-event";

export default async function EventSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await loadAdminEvent(id);
  const branding = await getEventBranding(event.id);

  return (
    <EventSettings
      initialEvent={{
        id: event.id,
        name: event.name,
        status: event.status,
        batch: Number((event as { batch?: number }).batch) || 1,
        allowUpload: branding.allowUpload,
        eventDate: event.eventDate.toISOString(),
        themes: event.themes,
      }}
    />
  );
}
