import { prisma } from "./prisma";
import { appUrl } from "./runpod";

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [0, 2_000, 8_000];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mockEmail() {
  return process.env.MOCK_DELIVERY === "true" || !process.env.RESEND_API_KEY;
}

function mockSms() {
  return process.env.MOCK_DELIVERY === "true" || !process.env.TWILIO_AUTH_TOKEN;
}

export function resultLink(token: string) {
  return `${appUrl()}/r/${token}`;
}

async function sendEmail(to: string, link: string) {
  if (mockEmail()) {
    console.log(`[email mock] ${to} ${link}`);
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.EMAIL_FROM || "Photo Booth <booth@localhost>";
  const result = await resend.emails.send({
    from,
    to,
    subject: "Your portrait is ready",
    html: `
      <p>Your AI portrait is ready.</p>
      <p><a href="${link}">View and download your photo</a></p>
      <p>This link expires in 48 hours.</p>
    `,
  });
  if (result.error) throw new Error(result.error.message);
}

async function sendSms(to: string, link: string) {
  if (mockSms()) {
    console.log(`[sms mock] ${to} ${link}`);
    return;
  }

  const twilio = await import("twilio");
  const client = twilio.default(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN,
  );
  await client.messages.create({
    to,
    from: process.env.TWILIO_FROM_NUMBER,
    body: `Your portrait is ready: ${link} (link expires in 48 hours)`,
  });
}

async function attemptChannel(
  run: () => Promise<void>,
  priorAttempts: number,
): Promise<{ ok: boolean; attempts: number; error?: string }> {
  let attempts = priorAttempts;
  let lastError = "";

  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    if (i > 0) await sleep(BACKOFF_MS[i] ?? 8_000);
    attempts += 1;
    try {
      await run();
      return { ok: true, attempts };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return { ok: false, attempts, error: lastError };
}

export async function deliverJob(
  jobId: string,
  options?: { force?: boolean; channels?: Array<"email" | "sms"> },
) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "complete") {
    throw new Error("Job is not complete");
  }

  const link = resultLink(job.resultToken);
  const channels = options?.channels ?? ["email", "sms"];

  if (channels.includes("email")) {
    if (!job.email) {
      await prisma.job.update({
        where: { id: job.id },
        data: { emailStatus: "skipped" },
      });
    } else if (job.emailStatus !== "sent" || options?.force) {
      const result = await attemptChannel(
        () => sendEmail(job.email as string, link),
        options?.force ? 0 : job.emailAttempts,
      );
      await prisma.job.update({
        where: { id: job.id },
        data: {
          emailAttempts: result.attempts,
          emailStatus: result.ok ? "sent" : "failed",
          emailError: result.ok ? null : result.error,
        },
      });
    }
  }

  if (channels.includes("sms")) {
    if (!job.phone) {
      await prisma.job.update({
        where: { id: job.id },
        data: { smsStatus: "skipped" },
      });
    } else if (job.smsStatus !== "sent" || options?.force) {
      const result = await attemptChannel(
        () => sendSms(job.phone as string, link),
        options?.force ? 0 : job.smsAttempts,
      );
      await prisma.job.update({
        where: { id: job.id },
        data: {
          smsAttempts: result.attempts,
          smsStatus: result.ok ? "sent" : "failed",
          smsError: result.ok ? null : result.error,
        },
      });
    }
  }

  return prisma.job.findUnique({ where: { id: job.id } });
}

export async function retryFailedDeliveries() {
  const jobs = await prisma.job.findMany({
    where: {
      status: "complete",
      OR: [{ emailStatus: "failed" }, { smsStatus: "failed" }],
    },
    take: 25,
  });

  const results = [];
  for (const job of jobs) {
    const channels: Array<"email" | "sms"> = [];
    if (job.emailStatus === "failed") channels.push("email");
    if (job.smsStatus === "failed") channels.push("sms");
    results.push(await deliverJob(job.id, { channels }));
  }
  return results;
}
