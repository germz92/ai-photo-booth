import { requireAdmin, unauthorized } from "@/lib/admin";
import { getRunpodJobStatus } from "@/lib/runpod";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await requireAdmin())) return unauthorized();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return Response.json({ error: "Missing job id" }, { status: 400 });
  }

  try {
    const status = await getRunpodJobStatus(id);
    return Response.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
