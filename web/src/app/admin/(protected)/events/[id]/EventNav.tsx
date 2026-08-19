"use client";

import { usePathname } from "next/navigation";

export function EventNav({
  eventId,
  jobCount,
  status,
}: {
  eventId: string;
  jobCount: number;
  status: string;
}) {
  const pathname = usePathname();
  const queue = `/admin/events/${eventId}`;
  const settings = `${queue}/settings`;
  const branding = `${queue}/branding`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="filter-pills">
        <a href={queue} className={pathname === queue ? "active" : ""}>
          Queue
          <span className="ml-2 text-xs opacity-70">{jobCount}</span>
        </a>
        <a href={settings} className={pathname === settings ? "active" : ""}>
          Settings
        </a>
        <a href={branding} className={pathname === branding ? "active" : ""}>
          Branding
        </a>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status !== "archived" ? (
          <a className="booth-button min-h-10 px-4 text-xs" href={`/kiosk/${eventId}`}>
            Open kiosk
          </a>
        ) : null}
        <a
          className="booth-button-secondary min-h-10 px-4 text-xs"
          href={`/e/${eventId}`}
          target="_blank"
          rel="noreferrer"
        >
          TV wall
        </a>
      </div>
    </div>
  );
}
