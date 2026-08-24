import { after } from "next/server";
import { resultLink } from "./delivery";
import { completeMockJob, pollRunpodUntilDone, resultExpiry } from "./jobs";
import { prisma } from "./prisma";
import { submitRunpodJob } from "./runpod";
import { putObject } from "./storage";
import { loadThemeLooks, resolveJobKreaPrompt } from "./theme-looks-db";
import { isLookId, resolveThemePrompt } from "./theme-looks";
import { originalThumbKey, saveThumb } from "./thumbs";
import { creditErrorResponse, CreditError, withGenerationCredit } from "./users";
import { setJobGuestFields } from "./job-name";
import { createJobSchema, normalizeGuestName, normalizePhone } from "./validate";
import { clampBatch } from "./workflow";

export function photoFromForm(form: FormData, options?: { maxBytes?: number }) {
  const photo = form.get("photo");
  const maxBytes = options?.maxBytes ?? 6 * 1024 * 1024;
  if (!(photo instanceof File) || photo.size < 1) {
    return { error: "A photo is required", status: 400 as const };
  }
  if (photo.size > maxBytes) {
    return { error: `Photo must be under ${Math.round(maxBytes / (1024 * 1024))}MB`, status: 400 as const };
  }
  return { photo };
}

export function jobFieldsFromForm(form: FormData, eventId: string) {
  const lookValue = String(form.get("look") || "");
  return createJobSchema.safeParse({
    name: String(form.get("name") || ""),
    email: String(form.get("email") || ""),
    phone: String(form.get("phone") || ""),
    eventId,
    themeId: String(form.get("themeId") || ""),
    look: isLookId(lookValue) ? lookValue : undefined,
    skipContact: String(form.get("skipContact") || "") === "1" || String(form.get("source") || "") === "manual",
  });
}

export async function submitBoothJob(options: {
  ownerUserId: string;
  eventId: string;
  themeId: string;
  look?: string;
  name?: string;
  email?: string;
  phone?: string;
  photo: File;
  source?: "kiosk" | "manual";
}) {
  const theme = await prisma.theme.findFirst({
    where: {
      id: options.themeId,
      eventId: options.eventId,
      active: true,
      event: { status: { not: "archived" } },
    },
    include: { event: { select: { batch: true } } },
  });
  if (!theme) {
    return Response.json({ error: "Theme is not available" }, { status: 400 });
  }

  const looks = await loadThemeLooks(theme.id, theme.prompt);
  if (looks.splitLooks && !options.look) {
    return Response.json({ error: "Please choose a look" }, { status: 400 });
  }
  const prompt = resolveThemePrompt(looks, theme.prompt, options.look);
  if (!prompt) {
    return Response.json({ error: "Theme is not configured" }, { status: 400 });
  }
  const kreaPrompt = await resolveJobKreaPrompt({
    themeId: theme.id,
    themePrompt: theme.prompt,
    looks,
    qwenPrompt: prompt,
    look: options.look,
  });

  const bytes = Buffer.from(await options.photo.arrayBuffer());
  const imageBase64 = bytes.toString("base64");
  const batch = clampBatch(theme.event.batch, 1);
  const originalKey = `originals/${crypto.randomUUID()}.jpg`;

  try {
    const payload = await withGenerationCredit(options.ownerUserId, async () => {
      const [submitted] = await Promise.all([
        submitRunpodJob({
          imageBase64,
          qwenPrompt: prompt,
          kreaPrompt,
          batch,
        }),
        putObject(originalKey, bytes, options.photo.type || "image/jpeg"),
      ]);
      const token = crypto.randomUUID().replace(/-/g, "");
      const name = normalizeGuestName(options.name) || null;
      const email = options.email || null;
      const phone = normalizePhone(options.phone) || null;

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
          prompt,
          batch: submitted.batch,
          emailStatus: email ? "pending" : "skipped",
          smsStatus: phone ? "pending" : "skipped",
        },
      });
      if (name || options.source === "manual") {
        await setJobGuestFields(job.id, {
          name,
          manualUpload: options.source === "manual",
        });
      }

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
