import { jobOutputKeys } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import { contentTypeForKey, getObject } from "@/lib/storage";
import { outputThumbKey, readThumb } from "@/lib/thumbs";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; jobId: string }> },
) {
  const { id, jobId } = await context.params;
  const url = new URL(request.url);
  const index = Number(url.searchParams.get("i") || "0");
  const thumb = url.searchParams.get("size") === "thumb";
  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      eventId: id,
      status: "complete",
      outputKey: { not: null },
    },
  });
  const keys = job ? jobOutputKeys(job) : [];
  const key = keys[Number.isFinite(index) ? index : 0];
  if (!key) return new Response("Not found", { status: 404 });

  const body = thumb
    ? await readThumb(key, outputThumbKey(jobId, Number.isFinite(index) ? index : 0))
    : await getObject(key);
  const versioned = url.searchParams.has("v");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": thumb ? "image/jpeg" : contentTypeForKey(key),
      "Cache-Control": versioned ? "public, max-age=86400, immutable" : "no-store",
    },
  });
}
