import { galleryArchiveName, listEventGallery } from "@/lib/gallery";
import { prisma } from "@/lib/prisma";
import { getObject } from "@/lib/storage";
import { storedZipParts } from "@/lib/zip-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await context.params;
  if (!/^[a-f0-9]{24}$/i.test(eventId)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { name: true },
  });
  if (!event) return Response.json({ error: "Not found" }, { status: 404 });

  const files = await listEventGallery(eventId);
  if (!files.length) return Response.json({ error: "No portraits yet" }, { status: 404 });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const parts = storedZipParts(
          (async function* () {
            for (const file of files) {
              const data = await getObject(file.key);
              yield { name: file.filename, data };
            }
          })(),
        );
        for await (const part of parts) {
          controller.enqueue(new Uint8Array(part));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${galleryArchiveName(event.name)}"`,
      "Cache-Control": "no-store",
    },
  });
}
