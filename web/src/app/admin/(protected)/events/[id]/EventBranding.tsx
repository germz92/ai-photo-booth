"use client";

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import {
  clampOverlayAxis,
  clampOverlayScale,
  matchingOverlayPlacement,
  overlayCoordsForPlacement,
  overlayCoordsFromStored,
  OVERLAY_PLACEMENTS,
  type OverlayPlacement,
} from "@/lib/overlay";

const PLACEMENT_LABELS: Record<OverlayPlacement, string> = {
  "top-left": "Top left",
  "top-center": "Top center",
  "top-right": "Top right",
  "bottom-left": "Bottom left",
  "bottom-center": "Bottom center",
  "bottom-right": "Bottom right",
};

export type BrandingState = {
  wallTitle: string;
  showWallTitle: boolean;
  hasLogo: boolean;
  overlayEnabled: boolean;
  hasOverlayLogo: boolean;
  overlayScale: number;
  overlayX: number;
  overlayY: number;
  hasOverlaySample: boolean;
};

export function EventBranding({
  eventId,
  eventName,
  initial,
  onChange,
}: {
  eventId: string;
  eventName: string;
  initial: BrandingState;
  onChange?: (state: BrandingState) => void;
}) {
  const [wallTitle, setWallTitle] = useState(initial.wallTitle || "");
  const [showWallTitle, setShowWallTitle] = useState(initial.showWallTitle !== false);
  const [hasLogo, setHasLogo] = useState(Boolean(initial.hasLogo));
  const [hasOverlayLogo, setHasOverlayLogo] = useState(Boolean(initial.hasOverlayLogo));
  const [hasSample, setHasSample] = useState(Boolean(initial.hasOverlaySample));
  const [overlayEnabled, setOverlayEnabled] = useState(Boolean(initial.overlayEnabled));
  const initialCoords = overlayCoordsFromStored({
    x: initial.overlayX,
    y: initial.overlayY,
  });
  const [overlayX, setOverlayX] = useState(initialCoords.x);
  const [overlayY, setOverlayY] = useState(initialCoords.y);
  const [scale, setScale] = useState(clampOverlayScale(initial.overlayScale));
  const [wallStamp, setWallStamp] = useState(0);
  const [overlayStamp, setOverlayStamp] = useState(0);
  const [sampleStamp, setSampleStamp] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const selectedPlacement = matchingOverlayPlacement(overlayX, overlayY);
  const previewLogo = hasOverlayLogo || hasLogo;

  function applyPlacement(value: OverlayPlacement) {
    const coords = overlayCoordsForPlacement(value);
    setOverlayX(coords.x);
    setOverlayY(coords.y);
  }

  const overlaySrc = useMemo(() => {
    if (hasOverlayLogo) {
      return `/api/admin/events/${eventId}/logo?kind=overlay${overlayStamp ? `&t=${overlayStamp}` : ""}`;
    }
    if (hasLogo) return `/api/e/${eventId}/logo${wallStamp ? `?t=${wallStamp}` : ""}`;
    return "";
  }, [eventId, hasLogo, hasOverlayLogo, overlayStamp, wallStamp]);

  function snapshot(patch: Partial<BrandingState> = {}): BrandingState {
    const next = {
      wallTitle,
      showWallTitle,
      hasLogo,
      overlayEnabled,
      hasOverlayLogo,
      hasOverlaySample: hasSample,
      overlayScale: scale,
      overlayX,
      overlayY,
      ...patch,
    };
    onChange?.(next);
    return next;
  }

  async function save(formEvent: FormEvent) {
    formEvent.preventDefault();
    setBusy("save");
    setError("");
    const response = await fetch(`/api/admin/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallTitle,
        showWallTitle,
        overlayEnabled,
        overlayScale: scale,
        overlayX,
        overlayY,
      }),
    });
    const json = (await response.json()) as { error?: string };
    setBusy("");
    if (!response.ok) {
      setError(json.error || "Could not save branding");
      return;
    }
    snapshot();
  }

  async function uploadLogo(kind: "wall" | "overlay" | "sample", file: File) {
    setBusy(kind);
    setError("");
    const form = new FormData();
    form.append("logo", file);
    const response = await fetch(`/api/admin/events/${eventId}/logo?kind=${kind}`, {
      method: "POST",
      body: form,
    });
    const json = (await response.json()) as { error?: string };
    setBusy("");
    if (!response.ok) {
      setError(json.error || "Could not upload image");
      return;
    }
    if (kind === "wall") {
      setHasLogo(true);
      setWallStamp(Date.now());
      snapshot({ hasLogo: true });
    } else if (kind === "overlay") {
      setHasOverlayLogo(true);
      setOverlayStamp(Date.now());
      snapshot({ hasOverlayLogo: true });
    } else {
      setHasSample(true);
      setSampleStamp(Date.now());
      snapshot({ hasOverlaySample: true });
    }
  }

  async function removeLogo(kind: "wall" | "overlay" | "sample") {
    setBusy(kind);
    setError("");
    const response = await fetch(`/api/admin/events/${eventId}/logo?kind=${kind}`, {
      method: "DELETE",
    });
    setBusy("");
    if (!response.ok) {
      setError("Could not remove image");
      return;
    }
    if (kind === "wall") {
      setHasLogo(false);
      setWallStamp(Date.now());
      snapshot({ hasLogo: false });
    } else if (kind === "overlay") {
      setHasOverlayLogo(false);
      setOverlayStamp(Date.now());
      snapshot({ hasOverlayLogo: false });
    } else {
      setHasSample(false);
      setSampleStamp(Date.now());
      snapshot({ hasOverlaySample: false });
    }
  }

  async function downloadComp() {
    if (!hasSample || !previewLogo) {
      setError("Upload a sample photo and overlay logo first.");
      return;
    }
    setBusy("comp");
    setError("");
    try {
      const params = new URLSearchParams({
        scale: String(scale),
        x: String(overlayX),
        y: String(overlayY),
      });
      const response = await fetch(`/api/admin/events/${eventId}/overlay-comp?${params}`);
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error || "Could not download the overlay comp");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "overlay-comp.jpg";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download the overlay comp");
    } finally {
      setBusy("");
    }
  }

  return (
    <form className="grid gap-10" onSubmit={(form) => void save(form)}>
      <section className="grid gap-4">
        <div>
          <h2 className="text-xl font-light tracking-[0.08em] uppercase">TV wall</h2>
          <p className="mt-1 text-sm text-muted">
            Header on the public gallery screen. Choose No title for a logo-only header.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`kiosk-theme-btn min-w-24 ${showWallTitle ? "selected" : ""}`}
            onClick={() => setShowWallTitle(true)}
          >
            Show title
          </button>
          <button
            type="button"
            className={`kiosk-theme-btn min-w-24 ${showWallTitle ? "" : "selected"}`}
            onClick={() => setShowWallTitle(false)}
          >
            No title
          </button>
        </div>
        {showWallTitle ? (
          <label className="grid max-w-xl gap-1 text-sm">
            Custom title
            <input
              className="booth-input"
              value={wallTitle}
              onChange={(change) => setWallTitle(change.target.value)}
              placeholder={eventName || "Event name"}
            />
          </label>
        ) : null}
        <div className="flex flex-wrap items-center gap-4">
          {hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/e/${eventId}/logo${wallStamp ? `?t=${wallStamp}` : ""}`}
              alt="TV wall logo"
              className="h-14 w-auto max-w-[180px] rounded border border-white/10 bg-black object-contain p-2"
            />
          ) : (
            <div className="flex h-14 min-w-28 items-center justify-center rounded border border-dashed border-white/15 text-xs text-muted">
              No logo
            </div>
          )}
          <label className="booth-button-secondary min-h-10 cursor-pointer px-4 text-xs">
            {busy === "wall" ? "Uploading…" : hasLogo ? "Replace logo" : "Upload logo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={Boolean(busy)}
              onChange={(change) => {
                const file = change.target.files?.[0];
                change.target.value = "";
                if (file) void uploadLogo("wall", file);
              }}
            />
          </label>
          {hasLogo ? (
            <button
              type="button"
              className="booth-button-secondary min-h-10 px-4 text-xs"
              disabled={Boolean(busy)}
              onClick={() => void removeLogo("wall")}
            >
              Remove
            </button>
          ) : null}
        </div>
      </section>

      <section className="grid gap-5">
        <div>
          <h2 className="text-xl font-light tracking-[0.08em] uppercase">Portrait overlay</h2>
          <p className="mt-1 text-sm text-muted">
            Stamp a logo onto finished portraits. PNG with a transparent background works best.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`kiosk-theme-btn min-w-24 ${overlayEnabled ? "selected" : ""}`}
            onClick={() => setOverlayEnabled(true)}
          >
            Enabled
          </button>
          <button
            type="button"
            className={`kiosk-theme-btn min-w-24 ${overlayEnabled ? "" : "selected"}`}
            onClick={() => setOverlayEnabled(false)}
          >
            Disabled
          </button>
        </div>

        <div className="branding-overlay-layout">
        <div className="grid gap-3">
          <div
            className="branding-preview"
            style={
              {
                "--overlay-scale": String(scale),
                "--overlay-x": String(overlayX),
                "--overlay-y": String(overlayY),
              } as CSSProperties
            }
          >
            {hasSample ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/admin/events/${eventId}/logo?kind=sample${sampleStamp ? `&t=${sampleStamp}` : ""}`}
                alt="Sample portrait"
                className="branding-preview-sample"
              />
            ) : (
              <div className="branding-preview-scene" />
            )}
            {previewLogo && overlayEnabled ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={overlaySrc}
                alt="Overlay preview"
                className="branding-preview-logo"
              />
            ) : !hasSample ? (
              <p className="branding-preview-empty">
                {overlayEnabled ? "Upload a logo to preview" : "Overlay off"}
              </p>
            ) : null}
          </div>
          <div className="branding-preview-actions">
            <label className="booth-button-secondary min-h-10 cursor-pointer px-3 text-xs">
              {busy === "sample" ? "Uploading…" : hasSample ? "Replace sample" : "Upload sample"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={Boolean(busy)}
                onChange={(change) => {
                  const file = change.target.files?.[0];
                  change.target.value = "";
                  if (file) void uploadLogo("sample", file);
                }}
              />
            </label>
            {hasSample ? (
              <button
                type="button"
                className="booth-button-secondary min-h-10 px-3 text-xs"
                disabled={Boolean(busy)}
                onClick={() => void removeLogo("sample")}
              >
                Remove sample
              </button>
            ) : null}
            <button
              type="button"
              className="booth-button min-h-10 px-3 text-xs"
              disabled={Boolean(busy) || !hasSample || !previewLogo}
              onClick={() => void downloadComp()}
            >
              {busy === "comp" ? "Compositing…" : "Download overlay comp"}
            </button>
          </div>
        </div>

          <div className="grid gap-5">
            <div className="grid gap-2">
              <p className="booth-label">Placement</p>
              <div className="branding-placements">
                {OVERLAY_PLACEMENTS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`kiosk-theme-btn ${selectedPlacement === value ? "selected" : ""}`}
                    onClick={() => applyPlacement(value)}
                  >
                    {PLACEMENT_LABELS[value]}
                  </button>
                ))}
              </div>
            </div>

            <label className="grid gap-2 text-sm">
              <span className="booth-label">Size {Math.round(scale * 100)}%</span>
              <input
                className="branding-slider"
                type="range"
                min={2}
                max={100}
                value={Math.round(scale * 100)}
                onChange={(change) => setScale(clampOverlayScale(Number(change.target.value) / 100))}
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="booth-label">Position X {Math.round(overlayX * 100)}%</span>
              <input
                className="branding-slider"
                type="range"
                min={0}
                max={100}
                value={Math.round(overlayX * 100)}
                onChange={(change) => setOverlayX(clampOverlayAxis(Number(change.target.value) / 100, 0.5))}
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="booth-label">Position Y {Math.round(overlayY * 100)}%</span>
              <input
                className="branding-slider"
                type="range"
                min={0}
                max={100}
                value={Math.round(overlayY * 100)}
                onChange={(change) => setOverlayY(clampOverlayAxis(Number(change.target.value) / 100, 0.045))}
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              {hasOverlayLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/admin/events/${eventId}/logo?kind=overlay${overlayStamp ? `&t=${overlayStamp}` : ""}`}
                  alt="Overlay logo"
                  className="h-12 w-auto max-w-[140px] rounded border border-white/10 bg-black object-contain p-1.5"
                />
              ) : (
                <p className="text-sm text-muted">
                  {hasLogo ? "Using the TV wall logo until you upload a separate overlay." : "No overlay logo yet."}
                </p>
              )}
              <label className="booth-button-secondary min-h-10 cursor-pointer px-4 text-xs">
                {busy === "overlay" ? "Uploading…" : hasOverlayLogo ? "Replace overlay" : "Upload overlay"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={Boolean(busy)}
                  onChange={(change) => {
                    const file = change.target.files?.[0];
                    change.target.value = "";
                    if (file) void uploadLogo("overlay", file);
                  }}
                />
              </label>
              {hasOverlayLogo ? (
                <button
                  type="button"
                  className="booth-button-secondary min-h-10 px-4 text-xs"
                  disabled={Boolean(busy)}
                  onClick={() => void removeLogo("overlay")}
                >
                  Use wall logo
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <button type="submit" className="booth-button justify-self-start" disabled={Boolean(busy)}>
        {busy === "save" ? "Saving…" : "Save branding"}
      </button>
    </form>
  );
}
