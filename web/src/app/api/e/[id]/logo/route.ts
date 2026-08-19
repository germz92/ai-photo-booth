import { getEventBranding, prisma } from "@/lib/prisma";
import { contentTypeForKey, getObject } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const event = await prisma.event.findUnique({ where: { id }, select: { id: true } });
  if (!event) return new Response("Not found", { status: 404 });

  const branding = await getEventBranding(id);
  if (!branding.wallLogoKey) return new Response("Not found", { status: 404 });

  try {
    const body = await getObject(branding.wallLogoKey);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": contentTypeForKey(branding.wallLogoKey),
        "Cache-Control": "public, max-age=30",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
