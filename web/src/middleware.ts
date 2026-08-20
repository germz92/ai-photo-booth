import { NextResponse, type NextRequest } from "next/server";
import {
  isKioskLockedAdminPath,
  KIOSK_LOCK_COOKIE,
  kioskLockCookieOptions,
  parseKioskLockEventId,
} from "@/lib/kiosk-lock";

function lockedEventId(request: NextRequest) {
  return parseKioskLockEventId(request.cookies.get(KIOSK_LOCK_COOKIE)?.value);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const kioskMatch = pathname.match(/^\/kiosk\/([a-f0-9]{24})$/i);

  if (kioskMatch) {
    const response = NextResponse.next();
    response.cookies.set(KIOSK_LOCK_COOKIE, kioskMatch[1], kioskLockCookieOptions());
    return response;
  }

  const eventId = lockedEventId(request);
  if (!eventId || !isKioskLockedAdminPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Kiosk is locked" }, { status: 401 });
  }

  const unlock = request.nextUrl.clone();
  unlock.pathname = "/kiosk-lock";
  unlock.search = "";
  const next = `${pathname}${request.nextUrl.search}`;
  if (next && next !== "/kiosk-lock") unlock.searchParams.set("next", next);
  return NextResponse.redirect(unlock);
}

export const config = {
  matcher: ["/", "/kiosk/:path*", "/kiosk-lock", "/admin/:path*", "/test/:path*", "/api/admin/:path*", "/api/test/:path*", "/api/me"],
};
