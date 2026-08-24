"use client";

import { useEffect, useRef, useState } from "react";
import { mediaVersion } from "@/app/admin/(protected)/events/[id]/queue";
import type { ThemePreviewFlags } from "@/lib/theme-previews";
import type { PreviewKind } from "@/lib/theme-previews";

type PortraitChoice = {
  id: string;
  outputCount: number;
  updatedAt: string;
  themeId: string;
};

function previewSrc(themeId: string, kind: PreviewKind, version: string) {
  const query = version ? `?kind=${kind}&v=${encodeURIComponent(version)}` : `?kind=${kind}`;
  return `/api/admin/themes/${themeId}/preview${query}`;
}

function PreviewSlot({
  themeId,
  kind,
  label,
  hasImage,
  version,
  busy,
  onUpload,
  onPick,
  onRemove,
}: {
  themeId: string;
  kind: PreviewKind;
  label: string;
  hasImage: boolean;
  version: string;
  busy: boolean;
  onUpload: (kind: PreviewKind, file: File) => void;
  onPick: (kind: PreviewKind) => void;
  onRemove: (kind: PreviewKind) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="theme-preview-slot">
      <div className="theme-preview-frame">
        {hasImage ? (
          <img src={previewSrc(themeId, kind, version)} alt="" className="theme-preview-image" />
        ) : (
          <span className="theme-preview-empty">No preview</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="booth-label mb-2">{label}</p>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(change) => {
              const file = change.target.files?.[0];
              change.target.value = "";
              if (file) onUpload(kind, file);
            }}
          />
          <button
            type="button"
            className="booth-button-secondary is-compact"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            Upload
          </button>
          <button
            type="button"
            className="booth-button-secondary is-compact"
            disabled={busy}
            onClick={() => onPick(kind)}
          >
            Use portrait
          </button>
          {hasImage ? (
            <button
              type="button"
              className="booth-button-secondary is-compact"
              disabled={busy}
              onClick={() => onRemove(kind)}
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ThemePreviewControls({
  eventId,
  themeId,
  splitLooks,
  initial,
  onChange,
}: {
  eventId: string;
  themeId: string;
  splitLooks: boolean;
  initial: ThemePreviewFlags;
  onChange: (next: ThemePreviewFlags) => void;
}) {
  const [flags, setFlags] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState<PreviewKind | null>(null);
  const [portraits, setPortraits] = useState<PortraitChoice[]>([]);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [selectedPortrait, setSelectedPortrait] = useState<{ job: PortraitChoice; index: number } | null>(null);

  useEffect(() => {
    setFlags(initial);
  }, [initial.hasPreview, initial.hasMasculinePreview, initial.hasFemininePreview, initial.previewVersion, themeId]);

  function apply(next: ThemePreviewFlags) {
    setFlags(next);
    onChange(next);
  }

  async function postPreview(kind: PreviewKind, body: FormData) {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/admin/themes/${themeId}/preview?kind=${kind}`, {
      method: "POST",
      body,
    });
    const json = (await response.json()) as ThemePreviewFlags & { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(json.error || "Could not save preview");
      return false;
    }
    apply({
      hasPreview: json.hasPreview,
      hasMasculinePreview: json.hasMasculinePreview,
      hasFemininePreview: json.hasFemininePreview,
      previewVersion: json.previewVersion,
    });
    return true;
  }

  async function upload(kind: PreviewKind, file: File) {
    const form = new FormData();
    form.append("image", file);
    await postPreview(kind, form);
  }

  async function remove(kind: PreviewKind) {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/admin/themes/${themeId}/preview?kind=${kind}`, {
      method: "DELETE",
    });
    const json = (await response.json()) as ThemePreviewFlags & { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(json.error || "Could not remove preview");
      return;
    }
    apply({
      hasPreview: json.hasPreview,
      hasMasculinePreview: json.hasMasculinePreview,
      hasFemininePreview: json.hasFemininePreview,
      previewVersion: json.previewVersion,
    });
  }

  async function openPicker(kind: PreviewKind) {
    setPicking(kind);
    setSelectedPortrait(null);
    setPickerBusy(true);
    setError("");
    const params = new URLSearchParams({ status: "complete", limit: "24", themeId });
    const response = await fetch(`/api/admin/events/${eventId}/jobs?${params}`);
    const json = (await response.json()) as { jobs?: PortraitChoice[]; error?: string };
    if (!response.ok) {
      setPickerBusy(false);
      setError(json.error || "Could not load portraits");
      return;
    }
    let jobs = (json.jobs || []).filter((job) => job.outputCount > 0);
    if (jobs.length === 0) {
      const fallback = await fetch(`/api/admin/events/${eventId}/jobs?status=complete&limit=24`);
      const extra = (await fallback.json()) as { jobs?: PortraitChoice[] };
      jobs = (extra.jobs || []).filter((job) => job.outputCount > 0);
    }
    setPortraits(jobs);
    setPickerBusy(false);
  }

  async function confirmPortrait() {
    if (!picking || !selectedPortrait) return;
    const form = new FormData();
    form.append("jobId", selectedPortrait.job.id);
    form.append("index", String(selectedPortrait.index));
    const ok = await postPreview(picking, form);
    if (ok) {
      setPicking(null);
      setSelectedPortrait(null);
    }
  }

  function closePicker() {
    if (busy) return;
    setPicking(null);
    setSelectedPortrait(null);
  }

  return (
    <div className="mt-6 grid gap-4">
      <div>
        <p className="booth-label">Theme preview</p>
        <p className="text-sm text-muted">
          Guests see this after they tap the theme, then confirm the style. Upload an image or use an
          existing portrait.
        </p>
      </div>
      <PreviewSlot
        themeId={themeId}
        kind="main"
        label="Preview"
        hasImage={flags.hasPreview}
        version={flags.previewVersion}
        busy={busy}
        onUpload={upload}
        onPick={openPicker}
        onRemove={remove}
      />
      {splitLooks ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <PreviewSlot
            themeId={themeId}
            kind="masculine"
            label="Masculine preview"
            hasImage={flags.hasMasculinePreview}
            version={flags.previewVersion}
            busy={busy}
            onUpload={upload}
            onPick={openPicker}
            onRemove={remove}
          />
          <PreviewSlot
            themeId={themeId}
            kind="feminine"
            label="Feminine preview"
            hasImage={flags.hasFemininePreview}
            version={flags.previewVersion}
            busy={busy}
            onUpload={upload}
            onPick={openPicker}
            onRemove={remove}
          />
        </div>
      ) : null}
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {picking ? (
        <div
          className="lightbox"
          onClick={(click) => {
            click.stopPropagation();
            closePicker();
          }}
          role="presentation"
        >
          <div className="settings-modal" onClick={(click) => click.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs tracking-[0.28em] uppercase text-accent">Preview</p>
                <h2 className="mt-2 text-xl font-light tracking-[0.08em] uppercase">Use a portrait</h2>
              </div>
              <button type="button" className="booth-button-secondary is-compact" disabled={busy} onClick={closePicker}>
                Close
              </button>
            </div>
            {pickerBusy ? (
              <p className="mt-6 text-sm text-muted">Loading portraits…</p>
            ) : portraits.length === 0 ? (
              <p className="mt-6 text-sm text-muted">No completed portraits yet. Upload an image instead.</p>
            ) : (
              <>
                <p className="mt-4 text-sm text-muted">Tap a portrait, then confirm to use it as the preview.</p>
                <div className="theme-preview-picker">
                  {portraits.flatMap((job) =>
                    Array.from({ length: job.outputCount }, (_, index) => {
                      const selected =
                        selectedPortrait?.job.id === job.id && selectedPortrait.index === index;
                      return (
                        <button
                          key={`${job.id}-${index}`}
                          type="button"
                          className={`theme-preview-pick${selected ? " selected" : ""}`}
                          onClick={() => setSelectedPortrait({ job, index })}
                          disabled={busy}
                        >
                          <img
                            src={`/api/admin/jobs/${job.id}/media?which=output&i=${index}&size=thumb&v=${mediaVersion(job.updatedAt)}`}
                            alt=""
                          />
                          {selected ? <span className="theme-preview-pick-mark">Selected</span> : null}
                        </button>
                      );
                    }),
                  )}
                </div>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button type="button" className="booth-button-secondary is-compact" disabled={busy} onClick={closePicker}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="booth-button is-compact"
                    disabled={busy || !selectedPortrait}
                    onClick={() => void confirmPortrait()}
                  >
                    {busy ? "Saving…" : "Use this portrait"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
