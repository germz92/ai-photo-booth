"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CaptureSettings, type CaptureState } from "./CaptureSettings";
import { EventBranding, type BrandingState } from "./EventBranding";
import { EventSettings, type SettingsEvent } from "./EventSettings";

const TABS = [
  { id: "event", label: "Event" },
  { id: "theme", label: "Themes" },
  { id: "branding", label: "Branding" },
] as const;

export type SettingsTab = (typeof TABS)[number]["id"];

export function parseSettingsTab(value?: string | null): SettingsTab {
  if (value === "theme" || value === "branding") return value;
  return "event";
}

export function EventSettingsHub({
  eventId,
  initialTab,
  initialEvent,
  initialCapture,
  initialBranding,
}: {
  eventId: string;
  initialTab?: string | null;
  initialEvent: SettingsEvent;
  initialCapture: CaptureState;
  initialBranding: BrandingState;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<SettingsTab>(parseSettingsTab(initialTab));

  function select(next: SettingsTab) {
    setTab(next);
    const url = `/admin/events/${eventId}/settings${next === "event" ? "" : `?tab=${next}`}`;
    router.replace(url, { scroll: false });
  }

  return (
    <div className="grid gap-8">
      <div className="filter-pills">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "active" : ""}
            onClick={() => select(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "event" ? (
        <EventSettings
          initialEvent={initialEvent}
          section="event"
          afterIdentity={
            <CaptureSettings eventId={eventId} eventName={initialEvent.name} initial={initialCapture} compact />
          }
        />
      ) : null}
      {tab === "theme" ? <EventSettings initialEvent={initialEvent} section="themes" /> : null}
      {tab === "branding" ? (
        <EventBranding eventId={eventId} eventName={initialEvent.name} initial={initialBranding} />
      ) : null}
    </div>
  );
}
