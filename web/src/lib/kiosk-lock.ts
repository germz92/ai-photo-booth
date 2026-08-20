export const KIOSK_LOCK_COOKIE = "lumetry_kiosk_lock";

export function kioskLockCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

export function parseKioskLockEventId(value?: string | null) {
  const id = String(value || "").trim();
  return /^[a-f0-9]{24}$/i.test(id) ? id : "";
}

export function isKioskLockExemptPath(pathname: string) {
  return (
    pathname === "/admin/login" ||
    pathname.startsWith("/admin/login/") ||
    pathname === "/kiosk-lock" ||
    pathname === "/api/kiosk/unlock"
  );
}

export function isKioskLockedAdminPath(pathname: string) {
  if (isKioskLockExemptPath(pathname)) return false;
  return (
    pathname === "/" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/test") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/test") ||
    pathname === "/api/me"
  );
}
