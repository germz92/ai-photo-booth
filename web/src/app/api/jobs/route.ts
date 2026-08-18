import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { completeMockJob, resultExpiry } from "@/lib/jobs";
import { mockRunpod, submitRunpodJob } from "@/lib/runpod";
import { putObject } from "@/lib/storage";
import { createJobSchema, normalizePhone } from "@/lib/validate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size < 1) {
    return Response.json({ error: "A photo is required" }, { status: 400 });
  }
  if (photo.size > 6 * 1024 * 1024) {
    return Response.json({ error: "Photo must be under 6MB" }, { status: 400 });
  }

  const parsed = createJobSchema.safeParse({
    email: String(form.get("email") || ""),
    phone: String(form.get("phone") || ""),
    consent: String(form.get("consent") || "") === "true",
  });
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await photo.arrayBuffer());
  const imageBase64 = bytes.toString("base64");

  const submitted = await submitRunpodJob({ imageBase64 });
  const token = crypto.randomUUID().replace(/-/g, "");
  const email = parsed.data.email || null;
  const phone = normalizePhone(parsed.data.phone) || null;
  const originalKey = `originals/${crypto.randomUUID()}.jpg`;

  await putObject(originalKey, bytes, photo.type || "image/jpeg");

  const job = await prisma.job.create({
    data: {
      status: submitted.mocked ? "processing" : "submitted",
      email,
      phone,
      consent: true,
      originalKey,
      runpodJobId: submitted.id,
      resultToken: token,
      resultExpiresAt: resultExpiry(),
      kreaSeed: String(submitted.kreaSeed),
      qwenSeed: String(submitted.qwenSeed),
      emailStatus: email ? "pending" : "skipped",
      smsStatus: phone ? "pending" : "skipped",
    },
  });

  if (mockRunpod()) {
    after(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await completeMockJob(job.id);
    });
  }

  return Response.json({
    id: job.id,
    status: job.status,
    mocked: submitted.mocked,
  });
}
