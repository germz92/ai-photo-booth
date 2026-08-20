import { requireOwnedJob } from "@/lib/access";
import { jobOutputKeys } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import { contentTypeForKey, getObject } from "@/lib/storage";
import { originalThumbKey, outputThumbKey, readThumb } from "@/lib/thumbs";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedJob(id);
  if (!access.ok) return access.response;
  const url = new URL(request.url);
  const which = url.searchParams.get("which") || "output";
  const index = Number(url.searchParams.get("i") || "0");
  const download = url.searchParams.get("download") === "1";
  const thumb = url.searchParams.get("size") === "thumb";

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return new Response("Not found", { status: 404 });

  const key =
    which === "original" ? job.originalKey : jobOutputKeys(job)[Number.isFinite(index) ? index : 0];
  if (!key) return new Response("Not found", { status: 404 });

  const extension = key.endsWith(".png") ? "png" : key.endsWith(".webp") ? "webp" : "jpg";
  const filename =
    which === "original" ? `capture-${id}.${extension}` : `portrait-${id}-${(Number.isFinite(index) ? index : 0) + 1}.${extension}`;
  const body = thumb
    ? await readThumb(key, which === "original" ? originalThumbKey(id) : outputThumbKey(id, Number.isFinite(index) ? index : 0))
    : await getObject(key);
  const versioned = url.searchParams.has("v");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": thumb ? "image/jpeg" : contentTypeForKey(key),
      "Cache-Control": versioned
        ? thumb
          ? "private, max-age=86400, immutable"
          : "private, max-age=120"
        : "no-store",
      ...(download
        ? { "Content-Disposition": `attachment; filename="${filename}"` }
        : {}),
    },
  });
}
