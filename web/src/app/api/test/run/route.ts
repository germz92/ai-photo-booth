import { requireAdmin, unauthorized } from "@/lib/admin";
import { submitRunpodJob } from "@/lib/runpod";
import { clampBatch } from "@/lib/workflow";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await requireAdmin())) return unauthorized();
  if (!process.env.RUNPOD_API_KEY || !process.env.RUNPOD_ENDPOINT_ID) {
    return Response.json(
      { error: "Set RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID in web/.env" },
      { status: 400 },
    );
  }

  const form = await request.formData();
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size < 1) {
    return Response.json({ error: "A photo is required" }, { status: 400 });
  }
  if (photo.size > 6 * 1024 * 1024) {
    return Response.json({ error: "Photo must be under 6MB" }, { status: 400 });
  }

  const qwenPrompt = String(form.get("qwenPrompt") || "").trim();
  const batch = clampBatch(form.get("batch"));
  const bytes = Buffer.from(await photo.arrayBuffer());

  try {
    const submitted = await submitRunpodJob({
      imageBase64: bytes.toString("base64"),
      qwenPrompt: qwenPrompt || undefined,
      batch,
      forceLive: true,
      skipWebhook: true,
    });
    return Response.json({
      id: submitted.id,
      mocked: submitted.mocked,
      kreaSeed: submitted.kreaSeed,
      qwenSeed: submitted.qwenSeed,
      batch: submitted.batch,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
