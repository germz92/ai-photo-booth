import { requireUser, userOwnsEvent } from "@/lib/access";
import { unauthorized } from "@/lib/admin";
import { jobFieldsFromForm, photoFromForm, submitBoothJob } from "@/lib/create-job";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await requireUser();
  if (!session) return unauthorized();

  const form = await request.formData();
  const photoResult = photoFromForm(form);
  if ("error" in photoResult) {
    return Response.json({ error: photoResult.error }, { status: photoResult.status });
  }

  const parsed = jobFieldsFromForm(form, String(form.get("eventId") || ""));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 },
    );
  }

  if (!(await userOwnsEvent(session.user.id, parsed.data.eventId))) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  return submitBoothJob({
    ownerUserId: session.user.id,
    eventId: parsed.data.eventId,
    themeId: parsed.data.themeId,
    look: parsed.data.look,
    email: parsed.data.email,
    phone: parsed.data.phone,
    photo: photoResult.photo,
  });
}
