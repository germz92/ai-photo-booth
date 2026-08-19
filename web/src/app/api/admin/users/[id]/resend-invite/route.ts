import { requireSuperadmin } from "@/lib/access";
import { creditErrorResponse, resendInvite } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireSuperadmin();
  if (!access.ok) return access.response;
  const { id } = await context.params;
  try {
    const result = await resendInvite(id);
    return Response.json(result);
  } catch (error) {
    return creditErrorResponse(error);
  }
}
