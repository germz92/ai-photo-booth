import { getEventCaptureKiosk, publicCaptureKiosk } from "@/lib/capture-kiosk";
import { CaptureSettings } from "../CaptureSettings";
import { loadAdminEvent } from "../load-event";

export const dynamic = "force-dynamic";

export default async function CaptureSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await loadAdminEvent(id);
  const capture = publicCaptureKiosk(await getEventCaptureKiosk(event.id));

  return <CaptureSettings eventId={event.id} eventName={event.name} initial={capture} />;
}
