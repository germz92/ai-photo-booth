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

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="filter-pills">
        <a href={queue} className={pathname === queue ? "active" : ""}>
          Queue
          <span className="ml-2 text-xs opacity-70">{jobCount}</span>
        </a>
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
        {status !== "archived" ? (
          <a className="booth-button min-h-11 w-full px-4 text-xs sm:w-auto" href={`/kiosk/${eventId}`}>
            Open kiosk
          </a>
        ) : null}
        <a
          className="booth-button-secondary min-h-11 w-full px-4 text-xs sm:w-auto"
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
