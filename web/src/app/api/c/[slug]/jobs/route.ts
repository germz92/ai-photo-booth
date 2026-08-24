import { auth } from "@/auth";
import { userOwnsEvent } from "@/lib/access";
import { findLiveCaptureKiosk, hasCaptureUnlock } from "@/lib/capture-kiosk";
import { jobFieldsFromForm, photoFromForm, submitBoothJob } from "@/lib/create-job";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const kiosk = await findLiveCaptureKiosk(slug);
  if (!kiosk) return Response.json({ error: "Not found" }, { status: 404 });

  const session = await auth();
  const ownerOk = Boolean(session?.user?.id && (await userOwnsEvent(session.user.id, kiosk.eventId)));
  if (!ownerOk && !(await hasCaptureUnlock(kiosk.slug, kiosk.version))) {
    return Response.json({ error: "PIN required" }, { status: 401 });
  }

  const form = await request.formData();
  const photoResult = photoFromForm(form);
  if ("error" in photoResult) {
    return Response.json({ error: photoResult.error }, { status: photoResult.status });
  }

  const parsed = jobFieldsFromForm(form, kiosk.eventId);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 },
    );
  }

  const response = await submitBoothJob({
    ownerUserId: kiosk.ownerId,
    eventId: kiosk.eventId,
    themeId: parsed.data.themeId,
    look: parsed.data.look,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    photo: photoResult.photo,
  });
  if (response.status === 402) {
    return Response.json({ error: "This event isn't accepting photos right now." }, { status: 402 });
  }
  return response;
}
