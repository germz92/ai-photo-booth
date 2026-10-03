import { cookies } from "next/headers";
import { signOut } from "@/auth";
import { KIOSK_LOCK_COOKIE, kioskLockCookieOptions } from "@/lib/kiosk-lock";

export const runtime = "nodejs";

export async function POST() {
  const store = await cookies();
  store.set(KIOSK_LOCK_COOKIE, "", { ...kioskLockCookieOptions(), maxAge: 0 });
  await signOut({ redirect: false });
  return Response.json({ ok: true });
}
