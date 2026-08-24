"use client";

import { useState, type FormEvent } from "react";
import { BoothSelect } from "@/components/BoothSelect";
import { PhoneField } from "@/components/PhoneField";
import { fileToBoothJpeg } from "@/lib/booth-photo";
import { LOOK_OPTIONS } from "@/lib/theme-looks";

export type QueueTheme = {
  id: string;
  title: string;
  splitLooks: boolean;
  active: boolean;
};

export function ManualUpload({
  eventId,
  themes,
  onClose,
  onCreated,
}: {
  eventId: string;
  themes: QueueTheme[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const usable = themes.filter((theme) => theme.active);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [themeId, setThemeId] = useState(usable[0]?.id || "");
  const [look, setLook] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = usable.find((theme) => theme.id === themeId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!photo) {
      setError("Choose a photo");
      return;
    }
    if (!themeId) {
      setError("Choose a theme");
      return;
    }
    if (selected?.splitLooks && !look) {
      setError("Choose a look");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const boothPhoto = await fileToBoothJpeg(photo);
      const form = new FormData();
      form.append("photo", boothPhoto);
      form.append("eventId", eventId);
      form.append("themeId", themeId);
      form.append("name", name);
      form.append("email", email);
      form.append("phone", phone);
      form.append("source", "manual");
      if (look) form.append("look", look);
      const response = await fetch("/api/jobs", { method: "POST", body: form });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Could not upload");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lightbox" onClick={onClose} role="presentation">
      <form
        className="detail-modal"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => void submit(event)}
        aria-label="Manual upload"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.28em] uppercase text-accent">Queue</p>
            <h2 className="mt-2 text-2xl font-light tracking-[0.08em] uppercase">Manual upload</h2>
          </div>
          <button type="button" className="booth-button-secondary min-h-10 px-3 text-xs" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <label className="grid gap-2">
            <span className="booth-label">Photo</span>
            <input
              className="booth-input py-2"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(change) => {
                const file = change.target.files?.[0] || null;
                setPhoto(file);
                setPreview("");
                if (!file) return;
                void fileToBoothJpeg(file)
                  .then((next) => {
                    setPhoto(next);
                    setPreview(URL.createObjectURL(next));
                  })
                  .catch(() => setError("Could not read that image."));
              }}
            />
            {photo ? <p className="text-xs text-muted">{photo.name} · 832×1216</p> : null}
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Cropped capture" className="mt-1 max-h-48 w-auto rounded border border-white/10" />
            ) : null}
          </label>
          <div className="grid gap-2">
            <span className="booth-label">Theme</span>
            <BoothSelect
              label="Theme"
              value={themeId}
              placeholder={usable.length ? "Select a theme" : "No active themes"}
              disabled={!usable.length}
              options={usable.map((theme) => ({ value: theme.id, label: theme.title }))}
              onChange={(next) => {
                setThemeId(next);
                setLook("");
              }}
            />
          </div>
          {selected?.splitLooks ? (
            <div className="grid gap-2">
              <span className="booth-label">Look</span>
              <BoothSelect
                label="Look"
                value={look}
                placeholder="Select a look"
                options={LOOK_OPTIONS.map((option) => ({ value: option.id, label: option.label }))}
                onChange={setLook}
              />
            </div>
          ) : null}
          <label className="grid gap-2">
            <span className="booth-label">Name</span>
            <input className="booth-input" value={name} onChange={(change) => setName(change.target.value)} />
          </label>
          <label className="grid gap-2">
            <span className="booth-label">Email</span>
            <input
              className="booth-input"
              type="email"
              value={email}
              onChange={(change) => setEmail(change.target.value)}
            />
          </label>
          <label className="grid gap-2">
            <span className="booth-label">Mobile</span>
            <PhoneField value={phone} onChange={setPhone} />
          </label>
          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
          <button type="submit" className="booth-button mt-1" disabled={busy || !usable.length}>
            {busy ? "Uploading…" : "Add to queue"}
          </button>
        </div>
      </form>
    </div>
  );
}
