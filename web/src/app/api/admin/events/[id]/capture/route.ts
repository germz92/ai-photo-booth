import { requireOwnedEvent } from "@/lib/access";
import {
  createCaptureSlug,
  getEventCaptureKiosk,
  hashCapturePin,
  publicCaptureKiosk,
  saveEventCaptureKiosk,
  validateCapturePin,
} from "@/lib/capture-kiosk";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedEvent(id);
  if (!access.ok) return access.response;
  const state = await getEventCaptureKiosk(id);
  return Response.json({ capture: publicCaptureKiosk(state, { includePin: true }) });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedEvent(id);
  if (!access.ok) return access.response;
  const body = (await request.json()) as {
    enabled?: boolean;
    pin?: string;
    rotateLink?: boolean;
  };

  const current = await getEventCaptureKiosk(id);
  let enabled = current.enabled;
  let slug = current.slug;
  let pinHash = current.pinHash;
  let pin = current.pin;
  let version = current.version;

  if (typeof body.pin === "string" && body.pin.trim()) {
    const parsed = validateCapturePin(body.pin);
    if ("error" in parsed) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    pinHash = await hashCapturePin(parsed.pin);
    pin = parsed.pin;
    version += 1;
  }

  if (body.rotateLink === true) {
    slug = await createCaptureSlug(id);
    version += 1;
  }

  if (typeof body.enabled === "boolean") {
    enabled = body.enabled;
    if (enabled) {
      if (!pinHash) {
        return Response.json({ error: "Set a PIN before enabling the shared kiosk" }, { status: 400 });
      }
      if (!slug) slug = await createCaptureSlug(id);
    } else {
      version += 1;
    }
  }

  const saved = await saveEventCaptureKiosk(id, { enabled, slug, pinHash, pin, version });
  return Response.json({ capture: publicCaptureKiosk(saved, { includePin: true }) });
}
