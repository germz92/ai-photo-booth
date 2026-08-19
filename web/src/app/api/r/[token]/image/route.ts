import { linkExpired, jobOutputKeys } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import { contentTypeForKey, getObject } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const index = Number(new URL(request.url).searchParams.get("i") || "0");
  const job = await prisma.job.findUnique({ where: { resultToken: token } });
  const keys = job ? jobOutputKeys(job) : [];
  const key = keys[Number.isFinite(index) ? index : 0];
  if (!job || !key) {
    return new Response("Not found", { status: 404 });
  }
  if (linkExpired(job.resultExpiresAt)) {
    return new Response("This link has expired", { status: 410 });
  }

  const body = await getObject(key);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": contentTypeForKey(key),
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename="portrait-${index + 1}${key.slice(key.lastIndexOf("."))}"`,
    },
  });
}
