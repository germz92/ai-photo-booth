import { retryFailedDeliveries } from "@/lib/delivery";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const header = request.headers.get("x-cron-secret");
    if (header !== secret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results = await retryFailedDeliveries();
  return Response.json({ retried: results.length });
}
