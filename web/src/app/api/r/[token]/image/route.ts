import { linkExpired } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import { getObject } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const job = await prisma.job.findUnique({ where: { resultToken: token } });
  if (!job || !job.outputKey) {
    return new Response("Not found", { status: 404 });
  }
  if (linkExpired(job.resultExpiresAt)) {
    return new Response("This link has expired", { status: 410 });
  }

  const body = await getObject(job.outputKey);
  const contentType = job.outputKey.endsWith(".jpg")
    ? "image/jpeg"
    : job.outputKey.endsWith(".webp")
      ? "image/webp"
      : "image/png";

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename="portrait${job.outputKey.slice(job.outputKey.lastIndexOf("."))}"`,
    },
  });
}
