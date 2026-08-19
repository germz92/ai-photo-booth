import { requireSuperadmin } from "@/lib/access";
import { creditErrorResponse, requestPasswordReset } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireSuperadmin();
  if (!access.ok) return access.response;
  const { id } = await context.params;
  try {
    const result = await requestPasswordReset(id);
    return Response.json(result);
  } catch (error) {
    return creditErrorResponse(error);
  }
}
