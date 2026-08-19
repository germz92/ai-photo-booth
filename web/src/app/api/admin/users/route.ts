import { requireSuperadmin } from "@/lib/access";
import { creditErrorResponse, inviteUser, listUsers } from "@/lib/users";

export const runtime = "nodejs";

export async function GET() {
  const access = await requireSuperadmin();
  if (!access.ok) return access.response;
  return Response.json({ users: await listUsers() });
}

export async function POST(request: Request) {
  const access = await requireSuperadmin();
  if (!access.ok) return access.response;
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    credits?: number;
  };
  try {
    const result = await inviteUser({
      email: String(body.email || ""),
      name: body.name,
      credits: body.credits,
      createdBy: access.session.user.id,
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return creditErrorResponse(error);
  }
}
