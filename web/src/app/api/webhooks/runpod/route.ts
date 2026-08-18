import { handleRunpodWebhook } from "@/lib/jobs";
import type { RunpodWebhookPayload } from "@/lib/runpod";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const url = new URL(request.url);
    const provided = url.searchParams.get("secret");
    if (provided !== secret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const payload = (await request.json()) as RunpodWebhookPayload;
  try {
    const result = await handleRunpodWebhook(payload);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 400 });
  }
}
