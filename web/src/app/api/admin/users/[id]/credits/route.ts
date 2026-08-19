import { requireSuperadmin } from "@/lib/access";
import { adjustCredits, creditErrorResponse } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireSuperadmin();
  if (!access.ok) return access.response;
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    delta?: number;
    note?: string;
  };
  try {
    const user = await adjustCredits(id, Number(body.delta), {
      note: String(body.note || "").trim(),
      createdBy: access.session.user.id,
      reason: "admin_adjust",
    });
    return Response.json({ user });
  } catch (error) {
    return creditErrorResponse(error);
  }
}
