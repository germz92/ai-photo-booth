"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BoothSelect } from "@/components/BoothSelect";
import type { EventListItem } from "@/lib/event-list";

const EVENT_STATUS_OPTIONS = [
  { value: "draft", label: "draft" },
  { value: "live", label: "live" },
  { value: "archived", label: "archived" },
];

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function monogram(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || "EV";
}

function logoSrc(event: EventListItem) {
  if (!event.hasLogo) return "";
  const version = event.logoVersion ? `?v=${encodeURIComponent(event.logoVersion)}` : "";
  return `/api/admin/events/${event.id}/logo${version}`;
}

function EventLogo({ event }: { event: EventListItem }) {
  const [failed, setFailed] = useState(false);
  const src = logoSrc(event);
  if (src && !failed) {
    return <img src={src} alt="" className="event-card-logo-image" onError={() => setFailed(true)} />;
  }
  return <span className="event-card-monogram">{monogram(event.name)}</span>;
}

export function EventList({ initialEvents }: { initialEvents: EventListItem[] }) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, eventDate, status: "draft" }),
    });
    const json = (await response.json()) as { event?: { id: string }; error?: string };
    setBusy(false);
    if (!response.ok || !json.event) {
      setError(json.error || "Could not create event");
      return;
    }
    setName("");
    router.push(`/admin/events/${json.event.id}/settings`);
  }

  async function refresh() {
    const response = await fetch("/api/admin/events");
    const json = (await response.json()) as { events?: EventListItem[] };
    if (json.events) setEvents(json.events);
  }

  async function setStatus(id: string, status: string) {
    await fetch(`/api/admin/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await refresh();
  }

  return (
    <div className="grid gap-8">
      <form className="event-create" onSubmit={(event) => void onCreate(event)}>
        <p className="booth-label mb-0">New event</p>
        <div className="event-create-fields">
          <label className="grid min-w-0 gap-1 text-sm">
            Event name
            <input
              className="booth-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              placeholder="Acme Gala"
            />
          </label>
          <label className="grid min-w-0 gap-1 text-sm">
            Date
            <input
              className="booth-input"
              type="date"
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
              required
            />
          </label>
          <button type="submit" className="booth-button w-full md:w-auto md:self-end" disabled={busy}>
            {busy ? "Saving…" : "Create"}
          </button>
        </div>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      </form>

      {events.length === 0 ? (
        <div className="event-empty">
          <p className="event-empty-title">No events yet</p>
          <p className="text-sm text-muted">Create one above, then add themes and open the kiosk.</p>
        </div>
      ) : (
        <div className="event-list-grid">
          {events.map((event) => (
            <article
              key={event.id}
              className={`event-card${event.status === "archived" ? " is-archived" : ""}`}
            >
              <div className="event-card-top">
                <a href={`/admin/events/${event.id}`} className="event-card-logo" aria-hidden="true">
                  <EventLogo event={event} />
                </a>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <a href={`/admin/events/${event.id}`} className="min-w-0">
                      <h2 className="event-card-title">{event.name}</h2>
                    </a>
                    <span className={`event-status is-${event.status}`}>{event.status}</span>
                  </div>
                  <p className="event-card-meta">
                    {dateLabel(event.eventDate)}
                    <span>·</span>
                    {event._count.themes} {event._count.themes === 1 ? "theme" : "themes"}
                    <span>·</span>
                    {event._count.jobs} {event._count.jobs === 1 ? "portrait" : "portraits"}
                  </p>
                </div>
              </div>
              <div className="event-card-actions">
                <BoothSelect
                  className="event-card-status"
                  label={`Status for ${event.name}`}
                  value={event.status}
                  options={EVENT_STATUS_OPTIONS}
                  onChange={(next) => void setStatus(event.id, next)}
                />
                <a className="booth-button-secondary is-compact" href={`/admin/events/${event.id}`}>
                  Open
                </a>
                {event.status !== "archived" ? (
                  <a className="booth-button is-compact" href={`/kiosk/${event.id}`}>
                    Kiosk
                  </a>
                ) : null}
                <a
                  className="booth-button-secondary is-compact"
                  href={`/e/${event.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  TV
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
