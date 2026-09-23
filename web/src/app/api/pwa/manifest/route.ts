import { pwaManifest } from "@/lib/pwa";

export const runtime = "nodejs";

export function GET() {
  return Response.json(pwaManifest(), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
