"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type EventRow = {
  id: string;
  name: string;
  eventDate: string;
  status: string;
  _count: { themes: number; jobs: number };
};

function dateValue(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

export function EventList({ initialEvents }: { initialEvents: EventRow[] }) {
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
    const json = (await response.json()) as { event?: EventRow; error?: string };
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
    const json = (await response.json()) as { events?: EventRow[] };
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
    <div className="grid gap-10">
      <form className="grid gap-4 md:grid-cols-[1fr_auto_auto]" onSubmit={(event) => void onCreate(event)}>
        <label className="grid gap-1 text-sm">
          Event name
          <input
            className="booth-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="Acme Gala"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Date
          <input
            className="booth-input"
            type="date"
            value={eventDate}
            onChange={(event) => setEventDate(event.target.value)}
            required
          />
        </label>
        <button type="submit" className="booth-button self-end" disabled={busy}>
          {busy ? "Saving…" : "Create"}
        </button>
      </form>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="grid gap-3">
        {events.length === 0 ? (
          <p className="text-sm text-muted">No events yet.</p>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="flex flex-wrap items-center justify-between gap-3 border border-[var(--line)] px-4 py-3"
            >
              <a href={`/admin/events/${event.id}`} className="min-w-0">
                <p className="font-medium">{event.name}</p>
                <p className="text-xs text-muted">
                  {dateValue(event.eventDate)} · {event._count.themes} themes · {event._count.jobs} jobs
                </p>
              </a>
              <div className="flex items-center gap-2">
                <select
                  className="booth-input min-h-10 w-32"
                  value={event.status}
                  onChange={(change) => void setStatus(event.id, change.target.value)}
                >
                  <option value="draft">draft</option>
                  <option value="live">live</option>
                  <option value="archived">archived</option>
                </select>
                <a className="booth-button-secondary min-h-10 px-4 text-xs" href={`/admin/events/${event.id}`}>
                  Open
                </a>
                {event.status !== "archived" ? (
                  <a className="booth-button min-h-10 px-4 text-xs" href={`/kiosk/${event.id}`}>
                    Kiosk
                  </a>
                ) : null}
                <a
                  className="booth-button-secondary min-h-10 px-4 text-xs"
                  href={`/e/${event.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  TV
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
