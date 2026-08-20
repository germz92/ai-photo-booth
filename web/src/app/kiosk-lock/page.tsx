import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { KioskUnlockForm } from "@/components/KioskUnlockForm";
import { KIOSK_LOCK_COOKIE, parseKioskLockEventId } from "@/lib/kiosk-lock";

export const dynamic = "force-dynamic";

function safeNext(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/admin";
  }
  if (value.startsWith("/kiosk-lock")) return "/admin";
  return value;
}

export default async function KioskLockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const store = await cookies();
  const eventId = parseKioskLockEventId(store.get(KIOSK_LOCK_COOKIE)?.value);
  if (!eventId) redirect("/admin");
  const { next } = await searchParams;

  return <KioskUnlockForm kioskHref={`/kiosk/${eventId}`} nextHref={safeNext(next)} />;
}
