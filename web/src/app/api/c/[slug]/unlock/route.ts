import {
  findLiveCaptureKiosk,
  pinMatches,
  setCaptureUnlockCookie,
  validateCapturePin,
} from "@/lib/capture-kiosk";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const kiosk = await findLiveCaptureKiosk(slug);
  if (!kiosk) return Response.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json()) as { pin?: string };
  const parsed = validateCapturePin(String(body.pin || ""));
  if ("error" in parsed) {
    return Response.json({ error: "Incorrect PIN" }, { status: 401 });
  }
  if (!(await pinMatches(parsed.pin, kiosk.pinHash))) {
    return Response.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  await setCaptureUnlockCookie(kiosk.slug, kiosk.version);
  return Response.json({ ok: true });
}
