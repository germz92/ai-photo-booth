"use client";

import { useState } from "react";
import { APP_NAME } from "@/lib/brand";
import { LOOK_OPTIONS, type LookId } from "@/lib/theme-looks";

export type SampleTheme = {
  id: string;
  title: string;
  splitLooks?: boolean;
  hasPreview?: boolean;
  hasMasculinePreview?: boolean;
  hasFemininePreview?: boolean;
  previewVersion?: string;
};

function previewUrl(theme: SampleTheme, kind: "main" | "masculine" | "feminine") {
  const version = theme.previewVersion ? `&v=${encodeURIComponent(theme.previewVersion)}` : "";
  return `/api/t/${theme.id}/preview?kind=${kind}${version}`;
}

function themeThumbKind(theme: SampleTheme): "main" | "masculine" | "feminine" | "" {
  if (theme.hasPreview) return "main";
  if (theme.hasMasculinePreview) return "masculine";
  if (theme.hasFemininePreview) return "feminine";
  return "";
}

function LookIcon({ id }: { id: LookId }) {
  if (id === "feminine") {
    return (
      <svg viewBox="0 0 32 48" width="36" height="52" aria-hidden="true" fill="currentColor">
        <circle cx="16" cy="6" r="5" />
        <path d="M10 14h12l6 16h-5l3 14h-5l-3-10h-4l-3 10h-5l3-14H4l6-16Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 48" width="36" height="52" aria-hidden="true" fill="currentColor">
      <circle cx="16" cy="6" r="5" />
      <rect x="4" y="14" width="24" height="5" rx="1" />
      <rect x="11" y="14" width="10" height="16" />
      <rect x="11" y="30" width="4" height="14" />
      <rect x="17" y="30" width="4" height="14" />
    </svg>
  );
}

export function ThemeSampleViewer({
  eventName,
  themes,
}: {
  eventName: string;
  themes: SampleTheme[];
}) {
  const [previewThemeId, setPreviewThemeId] = useState("");
  const [pickedLook, setPickedLook] = useState<LookId | "">("");
  const previewTheme = themes.find((theme) => theme.id === previewThemeId);

  function openTheme(theme: SampleTheme) {
    setPickedLook("");
    setPreviewThemeId(theme.id);
  }

  return (
    <main className="kiosk-send sample-styles">
      <header className="kiosk-send-header">
        <p className="text-xs tracking-[0.28em] uppercase text-accent">{eventName || APP_NAME}</p>
        <h1 className="page-title mt-2 tracking-[0.12em]">Sample styles</h1>
        <p className="mt-2 text-sm text-muted">Samples only — nothing is sent from this page.</p>
      </header>
      <div className="kiosk-send-form">
        <div className="kiosk-theme-scroll">
          {themes.length === 0 ? (
            <p className="text-sm text-muted">No sample styles are available yet.</p>
          ) : (
            <div className={`kiosk-theme-grid${themes.some((theme) => themeThumbKind(theme)) ? " has-previews" : ""}`}>
              {themes.map((theme) => {
                const thumb = themeThumbKind(theme);
                return (
                  <button
                    key={theme.id}
                    type="button"
                    className={`kiosk-theme-btn sample-style-btn${thumb ? " has-preview" : ""}${
                      previewThemeId === theme.id ? " selected" : ""
                    }`}
                    onClick={() => openTheme(theme)}
                  >
                    {thumb ? <img src={previewUrl(theme, thumb)} alt="" /> : null}
                    <span className="sample-style-meta">
                      <span className="sample-style-title">{theme.title}</span>
                      <span className="sample-style-cta">
                        {theme.splitLooks ? "Tap to view looks" : "Tap to preview"}
                        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="currentColor">
                          <path d="M6.2 3.2 10.8 8l-4.6 4.8-1.4-1.3L8 8 4.8 4.5z" />
                        </svg>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {previewTheme ? (
        <div className="kiosk-preview-overlay">
          <div className="kiosk-preview-card">
            <p className="text-xs tracking-[0.28em] uppercase text-accent">Preview</p>
            <h2 className="mt-2 text-xl font-light tracking-[0.12em] uppercase">{previewTheme.title}</h2>
            {previewTheme.splitLooks ? (
              <>
                <p className="mt-2 text-sm text-muted">Choose a look to compare masculine and feminine.</p>
                <div className="kiosk-preview-looks">
                  {LOOK_OPTIONS.map((option) => {
                    const kind =
                      option.id === "masculine" && previewTheme.hasMasculinePreview
                        ? "masculine"
                        : option.id === "feminine" && previewTheme.hasFemininePreview
                          ? "feminine"
                          : previewTheme.hasPreview
                            ? "main"
                            : "";
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`kiosk-preview-look${pickedLook === option.id ? " selected is-picked" : ""}`}
                        onClick={() => setPickedLook(option.id)}
                      >
                        {kind ? <img src={previewUrl(previewTheme, kind)} alt="" /> : <LookIcon id={option.id} />}
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : themeThumbKind(previewTheme) ? (
              <img
                className="kiosk-preview-image"
                src={previewUrl(previewTheme, themeThumbKind(previewTheme) || "main")}
                alt={previewTheme.title}
              />
            ) : (
              <p className="mt-4 text-sm text-muted">Preview not uploaded yet.</p>
            )}
            <button
              type="button"
              className="booth-button-secondary mt-5 w-full"
              onClick={() => {
                setPreviewThemeId("");
                setPickedLook("");
              }}
            >
              Back
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
