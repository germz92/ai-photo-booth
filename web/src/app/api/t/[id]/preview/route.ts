import { getDocument, prisma } from "@/lib/prisma";
import { contentTypeForKey, getObject } from "@/lib/storage";
import { isPreviewKind, parseThemePreviews, previewKeyFor } from "@/lib/theme-previews";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const theme = await prisma.theme.findFirst({
    where: { id, active: true, event: { status: { not: "archived" } } },
    select: { id: true },
  });
  if (!theme) return new Response("Not found", { status: 404 });

  const kindParam = new URL(request.url).searchParams.get("kind");
  const kind = isPreviewKind(kindParam) ? kindParam : "main";
  const key = previewKeyFor(parseThemePreviews(await getDocument("Theme", id)), kind);
  if (!key) return new Response("Not found", { status: 404 });

  try {
    const body = await getObject(key);
    const versioned = new URL(request.url).searchParams.has("v");
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": contentTypeForKey(key),
        "Cache-Control": versioned ? "public, max-age=86400, immutable" : "no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
