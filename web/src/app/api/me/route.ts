import { unauthorized } from "@/lib/admin";
import { requireUser } from "@/lib/access";
import { getUserAccount } from "@/lib/users";

export const runtime = "nodejs";

export async function GET() {
  const session = await requireUser();
  if (!session) return unauthorized();
  const user = await getUserAccount(session.user.id);
  if (!user) return unauthorized();
  return Response.json({ user });
}
