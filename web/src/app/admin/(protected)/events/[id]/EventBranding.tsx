"use client";

import { useEffect, useId, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import {
  clampOverlayAxis,
  clampOverlayScale,
  clampOverlayShadow,
  clampOverlayStrokeOpacity,
  clampOverlayStrokeWidth,
  matchingOverlayPlacement,
  overlayColorRgb,
  overlayCoordsForPlacement,
  overlayDropShadowCss,
  OVERLAY_PLACEMENTS,
  parseOverlayColor,
  parseStoredOverlayLayers,
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

export type OverlayLayerState = {
  hasLogo: boolean;
  usesWallLogo?: boolean;
  scale: number;
  x: number;
  y: number;
  dropShadow: boolean;
  shadow: number;
  stroke: boolean;
  strokeWidth: number;
  strokeColor: string;
  strokeOpacity: number;
};

export type BrandingState = {
  wallTitle: string;
  showWallTitle: boolean;
  hasLogo: boolean;
  overlayEnabled: boolean;
  hasOverlayLogo?: boolean;
  overlayScale?: number;
  overlayX?: number;
  overlayY?: number;
  overlayLayers?: OverlayLayerState[];
  hasOverlaySample: boolean;
};

function layersFromInitial(initial: BrandingState, hasWallLogo: boolean): OverlayLayerState[] {
  const stored = parseStoredOverlayLayers(initial.overlayLayers, {
    scale: initial.overlayScale,
    x: initial.overlayX,
    y: initial.overlayY,
  });
  return stored.map((layer, index) => {
    const incoming = initial.overlayLayers?.[index];
    const hasLogo = incoming?.hasLogo ?? (index === 0 ? Boolean(initial.hasOverlayLogo) : false);
    return {
      hasLogo,
      usesWallLogo: incoming?.usesWallLogo ?? (index === 0 && !hasLogo && hasWallLogo),
      scale: incoming?.scale ?? layer.scale,
      x: incoming?.x ?? layer.x,
      y: incoming?.y ?? layer.y,
      dropShadow: incoming?.dropShadow ?? layer.dropShadow,
      shadow: incoming?.shadow ?? layer.shadow,
      stroke: incoming?.stroke ?? layer.stroke,
      strokeWidth: incoming?.strokeWidth ?? layer.strokeWidth,
      strokeColor: incoming?.strokeColor ?? layer.strokeColor,
      strokeOpacity: incoming?.strokeOpacity ?? layer.strokeOpacity,
    };
  });
}

function StrokeColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const [draft, setDraft] = useState(value.toUpperCase());
  useEffect(() => {
    setDraft(value.toUpperCase());
  }, [value]);
  return (
    <div className="branding-color-row">
      <input
        type="color"
        className="branding-color-swatch"
        value={value}
        onChange={(change) => onChange(parseOverlayColor(change.target.value))}
        aria-label="Stroke color"
      />
      <input
        className="booth-input branding-color-hex"
        value={draft}
        spellCheck={false}
        onChange={(change) => {
          const next = change.target.value.startsWith("#") ? change.target.value : `#${change.target.value}`;
          setDraft(next.toUpperCase());
          if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(next)) onChange(parseOverlayColor(next));
        }}
        onBlur={() => setDraft(value.toUpperCase())}
      />
    </div>
  );
}

function OverlayLogoMark({
  src,
  alt,
  stroke,
  strokeWidth,
  strokeColor,
  strokeOpacity,
  dropShadow,
  shadow,
}: {
  src: string;
  alt: string;
  stroke: boolean;
  strokeWidth: number;
  strokeColor: string;
  strokeOpacity: number;
  dropShadow: boolean;
  shadow: number;
}) {
  const reactId = useId().replace(/:/g, "");
  const filterId = `${reactId}-stroke`;
  const filters: string[] = [];
  if (stroke) filters.push(`url(#${filterId})`);
  if (dropShadow) filters.push(overlayDropShadowCss(shadow));
  const { r, g, b } = overlayColorRgb(strokeColor);
  return (
    <>
      {stroke ? (
        <svg className="branding-fx-defs" aria-hidden>
          <filter
            id={filterId}
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
            colorInterpolationFilters="sRGB"
          >
            <feMorphology
              in="SourceAlpha"
              operator="dilate"
              radius={clampOverlayStrokeWidth(strokeWidth)}
              result="expanded"
            />
            <feFlood
              floodColor={`rgb(${r}, ${g}, ${b})`}
              floodOpacity={clampOverlayStrokeOpacity(strokeOpacity)}
              result="fill"
            />
            <feComposite in="fill" in2="expanded" operator="in" result="outline" />
            <feMerge>
              <feMergeNode in="outline" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </svg>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} style={filters.length ? { filter: filters.join(" ") } : undefined} />
    </>
  );
}

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
  const [hasSample, setHasSample] = useState(Boolean(initial.hasOverlaySample));
  const [overlayEnabled, setOverlayEnabled] = useState(Boolean(initial.overlayEnabled));
  const [layers, setLayers] = useState(() => layersFromInitial(initial, Boolean(initial.hasLogo)));
  const [selectedLayer, setSelectedLayer] = useState(0);
  const [wallStamp, setWallStamp] = useState(0);
  const [layerStamps, setLayerStamps] = useState(() => layers.map(() => 0));
  const [sampleStamp, setSampleStamp] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const current = layers[selectedLayer] || layers[0];
  const selectedPlacement = matchingOverlayPlacement(current.x, current.y);
  const previewLayers = layers.filter((layer, index) => layer.hasLogo || (index === 0 && layer.usesWallLogo && hasLogo));

  function updateLayer(index: number, patch: Partial<OverlayLayerState>) {
    setLayers((currentLayers) => currentLayers.map((layer, i) => (i === index ? { ...layer, ...patch } : layer)));
  }

  function applyPlacement(value: OverlayPlacement) {
    const coords = overlayCoordsForPlacement(value);
    updateLayer(selectedLayer, coords);
  }

  function overlaySrc(index: number, layer: OverlayLayerState) {
    if (layer.hasLogo || (index === 0 && layer.usesWallLogo && hasLogo)) {
      const stamp = layerStamps[index] || (index === 0 ? wallStamp : 0);
      return `/api/admin/events/${eventId}/logo?kind=overlay&layer=${index + 1}${stamp ? `&t=${stamp}` : ""}`;
    }
    return "";
  }

  function snapshot(patch: Partial<BrandingState> = {}): BrandingState {
    const next = {
      wallTitle,
      showWallTitle,
      hasLogo,
      overlayEnabled,
      hasOverlaySample: hasSample,
      overlayLayers: layers,
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
        overlayLayers: layers.map((layer) => ({
          scale: layer.scale,
          x: layer.x,
          y: layer.y,
          dropShadow: layer.dropShadow,
          shadow: layer.shadow,
          stroke: layer.stroke,
          strokeWidth: layer.strokeWidth,
          strokeColor: layer.strokeColor,
          strokeOpacity: layer.strokeOpacity,
        })),
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

  async function uploadLogo(kind: "wall" | "overlay" | "sample", file: File, layer = 0) {
    setBusy(kind === "overlay" ? `overlay-${layer}` : kind);
    setError("");
    const form = new FormData();
    form.append("logo", file);
    const layerQuery = kind === "overlay" ? `&layer=${layer + 1}` : "";
    const response = await fetch(`/api/admin/events/${eventId}/logo?kind=${kind}${layerQuery}`, {
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
      updateLayer(0, { usesWallLogo: !layers[0]?.hasLogo });
      snapshot({ hasLogo: true });
    } else if (kind === "overlay") {
      updateLayer(layer, { hasLogo: true, usesWallLogo: false });
      setLayerStamps((currentStamps) => currentStamps.map((stamp, index) => (index === layer ? Date.now() : stamp)));
    } else {
      setHasSample(true);
      setSampleStamp(Date.now());
      snapshot({ hasOverlaySample: true });
    }
  }

  async function removeLogo(kind: "wall" | "overlay" | "sample", layer = 0) {
    setBusy(kind === "overlay" ? `overlay-${layer}` : kind);
    setError("");
    const layerQuery = kind === "overlay" ? `&layer=${layer + 1}` : "";
    const response = await fetch(`/api/admin/events/${eventId}/logo?kind=${kind}${layerQuery}`, {
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
      updateLayer(0, { usesWallLogo: false });
      snapshot({ hasLogo: false });
    } else if (kind === "overlay") {
      updateLayer(layer, { hasLogo: false, usesWallLogo: layer === 0 && hasLogo });
      setLayerStamps((currentStamps) => currentStamps.map((stamp, index) => (index === layer ? Date.now() : stamp)));
    } else {
      setHasSample(false);
      setSampleStamp(Date.now());
      snapshot({ hasOverlaySample: false });
    }
  }

  async function downloadComp() {
    if (!hasSample || !previewLayers.length) {
      setError("Upload a sample photo and overlay logo first.");
      return;
    }
    setBusy("comp");
    setError("");
    try {
      const params = new URLSearchParams();
      layers.forEach((layer, index) => {
        const suffix = index === 0 ? "" : String(index + 1);
        params.set(`scale${suffix}`, String(layer.scale));
        params.set(`x${suffix}`, String(layer.x));
        params.set(`y${suffix}`, String(layer.y));
        params.set(`shadow${suffix}`, layer.dropShadow ? "1" : "0");
        params.set(`shadowAmt${suffix}`, String(layer.shadow));
        params.set(`stroke${suffix}`, layer.stroke ? "1" : "0");
        params.set(`strokeW${suffix}`, String(layer.strokeWidth));
        params.set(`strokeC${suffix}`, layer.strokeColor.replace("#", ""));
        params.set(`strokeO${suffix}`, String(layer.strokeOpacity));
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

  const currentSrc = useMemo(() => overlaySrc(selectedLayer, current), [eventId, selectedLayer, current, layerStamps, hasLogo, wallStamp]);

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
            Stamp up to three logos onto finished portraits. Use a transparent PNG — stroke and drop shadow
            follow the artwork, not the image box.
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
          <div className="branding-preview">
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
            {overlayEnabled
              ? layers.map((layer, index) => {
                  const src = overlaySrc(index, layer);
                  if (!src) return null;
                  return (
                    <span
                      key={`${index}-${layerStamps[index]}`}
                      className={`branding-preview-logo${selectedLayer === index ? " is-selected" : ""}`}
                      style={
                        {
                          "--overlay-scale": String(layer.scale),
                          "--overlay-x": String(layer.x),
                          "--overlay-y": String(layer.y),
                        } as CSSProperties
                      }
                    >
                      <OverlayLogoMark
                        src={src}
                        alt={`Overlay logo ${index + 1}`}
                        stroke={layer.stroke}
                        strokeWidth={layer.strokeWidth}
                        strokeColor={layer.strokeColor}
                        strokeOpacity={layer.strokeOpacity}
                        dropShadow={layer.dropShadow}
                        shadow={layer.shadow}
                      />
                    </span>
                  );
                })
              : !hasSample ? (
              <p className="branding-preview-empty">Overlay off</p>
            ) : null}
            {overlayEnabled && !previewLayers.length && !hasSample ? (
              <p className="branding-preview-empty">Upload a logo to preview</p>
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
              disabled={Boolean(busy) || !hasSample || !previewLayers.length}
              onClick={() => void downloadComp()}
            >
              {busy === "comp" ? "Compositing…" : "Download overlay comp"}
            </button>
          </div>
        </div>

          <div className="grid gap-5">
            <div className="branding-layer-tabs">
              {layers.map((layer, index) => (
                <button
                  key={index}
                  type="button"
                  className={`kiosk-theme-btn${selectedLayer === index ? " selected" : ""}`}
                  onClick={() => setSelectedLayer(index)}
                >
                  Logo {index + 1}
                  {layer.hasLogo || (index === 0 && layer.usesWallLogo) ? "" : " · empty"}
                </button>
              ))}
            </div>

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
              <span className="booth-label">Size {Math.round(current.scale * 100)}%</span>
              <input
                className="branding-slider"
                type="range"
                min={2}
                max={100}
                value={Math.round(current.scale * 100)}
                onChange={(change) =>
                  updateLayer(selectedLayer, { scale: clampOverlayScale(Number(change.target.value) / 100) })
                }
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="booth-label">Position X {Math.round(current.x * 100)}%</span>
              <input
                className="branding-slider"
                type="range"
                min={0}
                max={100}
                value={Math.round(current.x * 100)}
                onChange={(change) =>
                  updateLayer(selectedLayer, { x: clampOverlayAxis(Number(change.target.value) / 100, 0.5) })
                }
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="booth-label">Position Y {Math.round(current.y * 100)}%</span>
              <input
                className="branding-slider"
                type="range"
                min={0}
                max={100}
                value={Math.round(current.y * 100)}
                onChange={(change) =>
                  updateLayer(selectedLayer, { y: clampOverlayAxis(Number(change.target.value) / 100, 0.045) })
                }
              />
            </label>

            <div className="grid gap-2">
              <p className="booth-label">Drop shadow</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`kiosk-theme-btn min-w-24 ${current.dropShadow ? "selected" : ""}`}
                  onClick={() => updateLayer(selectedLayer, { dropShadow: true })}
                >
                  On
                </button>
                <button
                  type="button"
                  className={`kiosk-theme-btn min-w-24 ${current.dropShadow ? "" : "selected"}`}
                  onClick={() => updateLayer(selectedLayer, { dropShadow: false })}
                >
                  Off
                </button>
              </div>
            </div>
            {current.dropShadow ? (
              <label className="grid gap-2 text-sm">
                <span className="booth-label">Shadow {Math.round(current.shadow * 100)}%</span>
                <input
                  className="branding-slider"
                  type="range"
                  min={10}
                  max={100}
                  value={Math.round(current.shadow * 100)}
                  onChange={(change) =>
                    updateLayer(selectedLayer, { shadow: clampOverlayShadow(Number(change.target.value) / 100) })
                  }
                />
              </label>
            ) : null}

            <div className="grid gap-2">
              <p className="booth-label">Stroke</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`kiosk-theme-btn min-w-24 ${current.stroke ? "selected" : ""}`}
                  onClick={() => updateLayer(selectedLayer, { stroke: true })}
                >
                  On
                </button>
                <button
                  type="button"
                  className={`kiosk-theme-btn min-w-24 ${current.stroke ? "" : "selected"}`}
                  onClick={() => updateLayer(selectedLayer, { stroke: false })}
                >
                  Off
                </button>
              </div>
            </div>
            {current.stroke ? (
              <>
                <label className="grid gap-2 text-sm">
                  <span className="booth-label">Stroke width {current.strokeWidth}px</span>
                  <input
                    className="branding-slider"
                    type="range"
                    min={1}
                    max={16}
                    value={current.strokeWidth}
                    onChange={(change) =>
                      updateLayer(selectedLayer, {
                        strokeWidth: clampOverlayStrokeWidth(Number(change.target.value)),
                      })
                    }
                  />
                </label>
                <div className="grid gap-2">
                  <p className="booth-label">Stroke color</p>
                  <StrokeColorField
                    value={current.strokeColor}
                    onChange={(strokeColor) => updateLayer(selectedLayer, { strokeColor })}
                  />
                </div>
                <label className="grid gap-2 text-sm">
                  <span className="booth-label">Stroke opacity {Math.round(current.strokeOpacity * 100)}%</span>
                  <input
                    className="branding-slider"
                    type="range"
                    min={5}
                    max={100}
                    value={Math.round(current.strokeOpacity * 100)}
                    onChange={(change) =>
                      updateLayer(selectedLayer, {
                        strokeOpacity: clampOverlayStrokeOpacity(Number(change.target.value) / 100),
                      })
                    }
                  />
                </label>
              </>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              {currentSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentSrc}
                  alt={`Overlay logo ${selectedLayer + 1}`}
                  className="h-12 w-auto max-w-[140px] rounded border border-white/10 bg-black object-contain p-1.5"
                />
              ) : (
                <p className="text-sm text-muted">
                  {selectedLayer === 0 && hasLogo
                    ? "Using the TV wall logo until you upload a separate overlay."
                    : "No overlay logo yet."}
                </p>
              )}
              <label className="booth-button-secondary min-h-10 cursor-pointer px-4 text-xs">
                {busy === `overlay-${selectedLayer}`
                  ? "Uploading…"
                  : current.hasLogo
                    ? "Replace overlay"
                    : "Upload overlay"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={Boolean(busy)}
                  onChange={(change) => {
                    const file = change.target.files?.[0];
                    change.target.value = "";
                    if (file) void uploadLogo("overlay", file, selectedLayer);
                  }}
                />
              </label>
              {current.hasLogo ? (
                <button
                  type="button"
                  className="booth-button-secondary min-h-10 px-4 text-xs"
                  disabled={Boolean(busy)}
                  onClick={() => void removeLogo("overlay", selectedLayer)}
                >
                  {selectedLayer === 0 ? "Use wall logo" : "Remove"}
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
