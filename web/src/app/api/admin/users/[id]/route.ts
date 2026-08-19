import { requireSuperadmin } from "@/lib/access";
import { creditErrorResponse, updateUser } from "@/lib/users";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireSuperadmin();
  if (!access.ok) return access.response;
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    status?: string;
    role?: string;
  };
  try {
    const user = await updateUser(id, body, access.session.user.id);
    return Response.json({ user });
  } catch (error) {
    return creditErrorResponse(error);
  }
}
