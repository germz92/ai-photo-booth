import { requireSuperadmin } from "@/lib/access";
import { listLedger } from "@/lib/users";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireSuperadmin();
  if (!access.ok) return access.response;
  const { id } = await context.params;
  const limit = Number(new URL(request.url).searchParams.get("limit") || "50");
  return Response.json({ entries: await listLedger(id, limit) });
}
