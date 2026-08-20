import { cookies } from "next/headers";
import { auth } from "@/auth";
import { unauthorized } from "@/lib/admin";
import { KIOSK_LOCK_COOKIE, kioskLockCookieOptions } from "@/lib/kiosk-lock";
import { verifyAccountPassword } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const body = (await request.json()) as { password?: string };
  const password = String(body.password || "");
  if (!(await verifyAccountPassword(session.user.id, password))) {
    return Response.json({ error: "Incorrect password" }, { status: 401 });
  }

  const store = await cookies();
  store.set(KIOSK_LOCK_COOKIE, "", { ...kioskLockCookieOptions(), maxAge: 0 });
  return Response.json({ ok: true });
}
