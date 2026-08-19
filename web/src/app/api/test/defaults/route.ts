import { requireAdmin, unauthorized } from "@/lib/admin";
import { defaultQwenPrompt } from "@/lib/workflow";

export const runtime = "nodejs";

export async function GET() {
  if (!(await requireAdmin())) return unauthorized();
  const configured = Boolean(
    process.env.RUNPOD_API_KEY && process.env.RUNPOD_ENDPOINT_ID,
  );
  return Response.json({
    configured,
    endpointSet: Boolean(process.env.RUNPOD_ENDPOINT_ID),
    qwenPrompt: defaultQwenPrompt(),
  });
}
