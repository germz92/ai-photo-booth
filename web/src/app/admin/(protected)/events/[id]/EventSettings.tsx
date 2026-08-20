"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type Theme = {
  id: string;
  title: string;
  prompt: string;
  splitLooks: boolean;
  masculinePrompt: string;
  femininePrompt: string;
  sortOrder: number;
  active: boolean;
};

export type SettingsEvent = {
  id: string;
  name: string;
  eventDate: string;
  status: string;
  batch: number;
  allowUpload: boolean;
  themes: Theme[];
};

type ThemeModalState = { mode: "add" } | { mode: "edit"; theme: Theme };

function dateValue(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function allowsUpload(value: boolean | undefined) {
  return value === true;
}

function withLooks(theme: Theme): Theme {
  return {
    ...theme,
    splitLooks: theme.splitLooks === true,
    masculinePrompt: theme.masculinePrompt || "",
    femininePrompt: theme.femininePrompt || "",
  };
}

export function EventSettings({
  initialEvent,
  section = "all",
  afterIdentity,
}: {
  initialEvent: SettingsEvent;
  section?: "all" | "event" | "themes";
  afterIdentity?: ReactNode;
}) {
  const router = useRouter();
  const [event, setEvent] = useState({
    ...initialEvent,
    themes: initialEvent.themes.map(withLooks),
  });
  const [name, setName] = useState(initialEvent.name);
  const [eventDate, setEventDate] = useState(dateValue(initialEvent.eventDate));
  const [status, setStatus] = useState(initialEvent.status);
  const [batch, setBatch] = useState(initialEvent.batch || 1);
  const [allowUpload, setAllowUpload] = useState(allowsUpload(initialEvent.allowUpload));
  const [themeModal, setThemeModal] = useState<ThemeModalState | null>(null);
  const [themeTitle, setThemeTitle] = useState("");
  const [themePrompt, setThemePrompt] = useState("");
  const [splitLooks, setSplitLooks] = useState(false);
  const [masculinePrompt, setMasculinePrompt] = useState("");
  const [femininePrompt, setFemininePrompt] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function openAddTheme() {
    setError("");
    setThemeTitle("");
    setThemePrompt("");
    setSplitLooks(false);
    setMasculinePrompt("");
    setFemininePrompt("");
    setThemeModal({ mode: "add" });
  }

  function openEditTheme(theme: Theme) {
    const next = withLooks(theme);
    setError("");
    setThemeTitle(next.title);
    setThemePrompt(next.prompt);
    setSplitLooks(next.splitLooks);
    setMasculinePrompt(next.masculinePrompt || next.prompt);
    setFemininePrompt(next.femininePrompt || next.prompt);
    setThemeModal({ mode: "edit", theme: next });
  }

  function toggleSplitLooks(enabled: boolean) {
    setSplitLooks(enabled);
    if (enabled) {
      setMasculinePrompt((current) => current || themePrompt);
      setFemininePrompt((current) => current || themePrompt);
    } else {
      setThemePrompt((current) => current || masculinePrompt || femininePrompt);
    }
  }

  async function reload() {
    const response = await fetch(`/api/admin/events/${event.id}`);
    const json = (await response.json()) as {
      event?: SettingsEvent & { _count?: { jobs?: number } };
      error?: string;
    };
    if (json.event) {
      setEvent({
        id: json.event.id,
        name: json.event.name,
        eventDate: new Date(json.event.eventDate).toISOString(),
        status: json.event.status,
        batch: json.event.batch || 1,
        allowUpload: allowsUpload(json.event.allowUpload),
        themes: json.event.themes.map(withLooks),
      });
      setName(json.event.name);
      setEventDate(dateValue(String(json.event.eventDate)));
      setStatus(json.event.status);
      if (json.event.batch) setBatch(json.event.batch);
      setAllowUpload(allowsUpload(json.event.allowUpload));
    }
    router.refresh();
  }

  async function saveEvent(formEvent: FormEvent) {
    formEvent.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch(`/api/admin/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, eventDate, status, batch, allowUpload }),
    });
    const json = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(json.error || "Could not save event");
      return;
    }
    await reload();
  }

  async function saveThemeModal(formEvent: FormEvent) {
    formEvent.preventDefault();
    if (!themeModal) return;
    setBusy(true);
    setError("");
    const payload = {
      title: themeTitle,
      prompt: themePrompt,
      splitLooks,
      masculinePrompt,
      femininePrompt,
    };
    if (themeModal.mode === "add") {
      const response = await fetch(`/api/admin/events/${event.id}/themes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await response.json()) as { error?: string };
      setBusy(false);
      if (!response.ok) {
        setError(json.error || "Could not add theme");
        return;
      }
    } else {
      const response = await fetch(`/api/admin/themes/${themeModal.theme.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          active: themeModal.theme.active,
          sortOrder: themeModal.theme.sortOrder,
        }),
      });
      const json = (await response.json()) as { error?: string };
      setBusy(false);
      if (!response.ok) {
        setError(json.error || "Could not save theme");
        return;
      }
    }
    setThemeModal(null);
    await reload();
  }

  async function persistThemeOrder(themes: Theme[]) {
    setEvent((current) => ({ ...current, themes }));
    const response = await fetch(`/api/admin/events/${event.id}/themes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: themes.map((theme) => theme.id) }),
    });
    if (!response.ok) {
      const json = (await response.json()) as { error?: string };
      setError(json.error || "Could not reorder themes");
      await reload();
    }
  }

  async function moveTheme(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= event.themes.length) return;
    const next = [...event.themes];
    const [theme] = next.splice(index, 1);
    next.splice(nextIndex, 0, theme);
    await persistThemeOrder(next.map((item, sortOrder) => ({ ...item, sortOrder })));
  }

  async function dropTheme(targetIndex: number) {
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
    if (from == null || from === targetIndex) return;
    const next = [...event.themes];
    const [theme] = next.splice(from, 1);
    next.splice(targetIndex, 0, theme);
    await persistThemeOrder(next.map((item, sortOrder) => ({ ...item, sortOrder })));
  }

  async function removeTheme(id: string) {
    setBusy(true);
    await fetch(`/api/admin/themes/${id}`, { method: "DELETE" });
    setBusy(false);
    setThemeModal(null);
    await reload();
  }

  const showEvent = section === "all" || section === "event";
  const showThemes = section === "all" || section === "themes";

  return (
    <div className="grid gap-8">
      {showEvent ? (
      <form className="grid gap-4 md:grid-cols-3" onSubmit={(form) => void saveEvent(form)}>
        <label className="grid gap-1 text-sm md:col-span-1">
          Name
          <input className="booth-input" value={name} onChange={(change) => setName(change.target.value)} required />
        </label>
        <label className="grid gap-1 text-sm">
          Date
          <input
            className="booth-input"
            type="date"
            value={eventDate}
            onChange={(change) => setEventDate(change.target.value)}
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          Status
          <select className="booth-input" value={status} onChange={(change) => setStatus(change.target.value)}>
            <option value="draft">draft</option>
            <option value="live">live</option>
            <option value="archived">archived</option>
          </select>
        </label>
        {afterIdentity ? <div className="md:col-span-3">{afterIdentity}</div> : null}
        <div className="grid gap-2 md:col-span-3">
          <p className="booth-label">Image upload</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`kiosk-theme-btn min-w-24 ${allowUpload ? "selected" : ""}`}
              onClick={() => setAllowUpload(true)}
            >
              Enabled
            </button>
            <button
              type="button"
              className={`kiosk-theme-btn min-w-24 ${allowUpload ? "" : "selected"}`}
              onClick={() => setAllowUpload(false)}
            >
              Disabled
            </button>
          </div>
          <p className="text-sm text-muted">
            When enabled, guests can upload a photo instead of using the kiosk camera.
          </p>
        </div>
        <div className="grid gap-2 md:col-span-3">
          <p className="booth-label">Generations per capture</p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((value) => (
              <button
                key={value}
                type="button"
                className={`kiosk-theme-btn min-w-16 ${batch === value ? "selected" : ""}`}
                onClick={() => setBatch(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted">
            Each guest capture generates this many portraits. 1 is fastest; 4 takes longer on the GPU.
          </p>
        </div>
        <button type="submit" className="booth-button justify-self-start" disabled={busy}>
          Save event
        </button>
      </form>
      ) : null}

      {showThemes ? (
      <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-light tracking-[0.08em] uppercase">Themes</h2>
            <p className="mt-1 text-sm text-muted">
              Guests see the title only. Drag the handle or use Up/Down to change kiosk order.
            </p>
          </div>
          <button type="button" className="booth-button min-h-10 px-4 text-xs" onClick={openAddTheme}>
            Add theme
          </button>
        </div>

        {event.themes.length === 0 ? (
          <p className="text-sm text-muted">No themes yet.</p>
        ) : (
          <div className="grid gap-2">
            {event.themes.map((theme, index) => (
              <div
                key={theme.id}
                className={`theme-row${dragIndex === index ? " dragging" : ""}${dragOverIndex === index ? " drag-over" : ""}`}
                onDragOver={(drag) => {
                  drag.preventDefault();
                  setDragOverIndex(index);
                }}
                onDrop={(drag) => {
                  drag.preventDefault();
                  void dropTheme(index);
                }}
              >
                <button
                  type="button"
                  className="theme-handle"
                  draggable
                  aria-label={`Reorder ${theme.title}`}
                  onDragStart={() => {
                    dragIndexRef.current = index;
                    setDragIndex(index);
                  }}
                  onDragEnd={() => {
                    dragIndexRef.current = null;
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                >
                  ⋮⋮
                </button>
                <p className="min-w-0 flex-1 truncate font-medium">
                  {theme.title}
                  {theme.splitLooks ? (
                    <span className="ml-2 text-xs font-normal tracking-normal text-muted">two looks</span>
                  ) : null}
                  {theme.active ? "" : <span className="ml-2 text-xs text-muted">(inactive)</span>}
                </p>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className="booth-button-secondary min-h-10 px-3 text-xs"
                    disabled={index === 0}
                    onClick={() => void moveTheme(index, -1)}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="booth-button-secondary min-h-10 px-3 text-xs"
                    disabled={index === event.themes.length - 1}
                    onClick={() => void moveTheme(index, 1)}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    className="booth-button-secondary min-h-10 px-3 text-xs"
                    onClick={() => openEditTheme(theme)}
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      ) : null}

      {showThemes && themeModal ? (
        <div className="lightbox" onClick={() => setThemeModal(null)} role="presentation">
          <form
            className="settings-modal"
            onClick={(click) => click.stopPropagation()}
            onSubmit={(form) => void saveThemeModal(form)}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs tracking-[0.28em] uppercase text-accent">
                  {themeModal.mode === "add" ? "New theme" : "Edit theme"}
                </p>
                <h2 className="mt-2 text-2xl font-light tracking-[0.08em] uppercase">
                  {themeModal.mode === "add" ? "Add theme" : themeModal.theme.title}
                </h2>
              </div>
              <button
                type="button"
                className="booth-button-secondary min-h-10 px-3 text-xs"
                onClick={() => setThemeModal(null)}
              >
                Close
              </button>
            </div>

            <label className="mt-6 grid gap-2">
              <span className="booth-label">Title</span>
              <input
                className="booth-input"
                value={themeTitle}
                onChange={(change) => setThemeTitle(change.target.value)}
                placeholder="Cinematic smoke"
                required
              />
            </label>
            <label className="mt-4 flex items-start gap-3 rounded border border-white/10 bg-black/20 px-4 py-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                style={{ accentColor: "var(--accent)" }}
                checked={splitLooks}
                onChange={(change) => toggleSplitLooks(change.target.checked)}
              />
              <span>
                <span className="booth-label">Offer masculine and feminine looks</span>
                <span className="mt-1 block text-sm text-muted">
                  Guests choose a look after picking this theme. Use this when clothing, hair, or styling should differ.
                </span>
              </span>
            </label>
            {splitLooks ? (
              <>
                <label className="mt-4 grid gap-2">
                  <span className="booth-label">Masculine prompt</span>
                  <textarea
                    className="booth-input min-h-32 py-3"
                    value={masculinePrompt}
                    onChange={(change) => setMasculinePrompt(change.target.value)}
                    required
                  />
                </label>
                <label className="mt-4 grid gap-2">
                  <span className="booth-label">Feminine prompt</span>
                  <textarea
                    className="booth-input min-h-32 py-3"
                    value={femininePrompt}
                    onChange={(change) => setFemininePrompt(change.target.value)}
                    required
                  />
                </label>
              </>
            ) : (
              <label className="mt-4 grid gap-2">
                <span className="booth-label">Prompt</span>
                <textarea
                  className="booth-input min-h-40 py-3"
                  value={themePrompt}
                  onChange={(change) => setThemePrompt(change.target.value)}
                  required
                />
              </label>
            )}

            {error ? <p className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}

            <div className="mt-6 flex flex-wrap gap-2">
              <button type="submit" className="booth-button min-h-10 px-4 text-xs" disabled={busy}>
                {themeModal.mode === "add" ? "Add theme" : "Save theme"}
              </button>
              {themeModal.mode === "edit" ? (
                <button
                  type="button"
                  className="booth-button-secondary min-h-10 px-3 text-xs"
                  disabled={busy}
                  onClick={() => void removeTheme(themeModal.theme.id)}
                >
                  {themeModal.theme.active ? "Deactivate" : "Remove"}
                </button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}

      {error && !(showThemes && themeModal) ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
