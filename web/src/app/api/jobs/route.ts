import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, userOwnsEvent } from "@/lib/access";
import { unauthorized } from "@/lib/admin";
import { completeMockJob, pollRunpodUntilDone, resultExpiry } from "@/lib/jobs";
import { resultLink } from "@/lib/delivery";
import { submitRunpodJob } from "@/lib/runpod";
import { putObject } from "@/lib/storage";
import { originalThumbKey, saveThumb } from "@/lib/thumbs";
import { creditErrorResponse, CreditError, withGenerationCredit } from "@/lib/users";
import { createJobSchema, normalizePhone } from "@/lib/validate";
import { clampBatch } from "@/lib/workflow";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await requireUser();
  if (!session) return unauthorized();

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
    eventId: String(form.get("eventId") || ""),
    themeId: String(form.get("themeId") || ""),
    skipContact: String(form.get("skipContact") || "") === "1",
  });
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 },
    );
  }

  if (!(await userOwnsEvent(session.user.id, parsed.data.eventId))) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  const theme = await prisma.theme.findFirst({
    where: {
      id: parsed.data.themeId,
      eventId: parsed.data.eventId,
      active: true,
      event: { status: { not: "archived" } },
    },
    include: { event: { select: { batch: true } } },
  });
  if (!theme) {
    return Response.json({ error: "Theme is not available" }, { status: 400 });
  }

  const bytes = Buffer.from(await photo.arrayBuffer());
  const imageBase64 = bytes.toString("base64");
  const batch = clampBatch(theme.event.batch, 1);
  const originalKey = `originals/${crypto.randomUUID()}.jpg`;

  try {
    const payload = await withGenerationCredit(session.user.id, async () => {
      const [submitted] = await Promise.all([
        submitRunpodJob({
          imageBase64,
          qwenPrompt: theme.prompt,
          batch,
        }),
        putObject(originalKey, bytes, photo.type || "image/jpeg"),
      ]);
      const token = crypto.randomUUID().replace(/-/g, "");
      const email = parsed.data.email || null;
      const phone = normalizePhone(parsed.data.phone) || null;

      const job = await prisma.job.create({
        data: {
          eventId: theme.eventId,
          themeId: theme.id,
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
          prompt: theme.prompt,
          batch: submitted.batch,
          emailStatus: email ? "pending" : "skipped",
          smsStatus: phone ? "pending" : "skipped",
        },
      });

      after(async () => {
        const thumb = saveThumb(originalThumbKey(job.id), bytes).catch((error) => {
          console.error("Original thumb failed", error);
        });
        try {
          if (submitted.mocked) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            await completeMockJob(job.id);
            return;
          }
          await pollRunpodUntilDone(job.id);
        } catch (error) {
          console.error("Job finalize failed", error);
        } finally {
          await thumb;
        }
      });

      return {
        id: job.id,
        status: job.status,
        mocked: submitted.mocked,
        resultUrl: resultLink(token),
      };
    });
    return Response.json(payload);
  } catch (error) {
    if (error instanceof CreditError) return creditErrorResponse(error);
    const message = error instanceof Error ? error.message : "Could not submit";
    return Response.json({ error: message }, { status: 500 });
  }
}
