"use client";

import { useEffect, useState } from "react";

type GalleryPortrait = {
  id: string;
  themeTitle: string;
  thumb: string;
  src: string;
  filename: string;
};

export function ClientGallery({
  eventName,
  portraits,
  archiveHref,
}: {
  eventName: string;
  portraits: GalleryPortrait[];
  archiveHref: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const current = open == null ? null : portraits[open];

  useEffect(() => {
    if (open == null) return undefined;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
      if (event.key === "ArrowRight") setOpen((index) => (index == null ? index : (index + 1) % portraits.length));
      if (event.key === "ArrowLeft") {
        setOpen((index) => (index == null ? index : (index - 1 + portraits.length) % portraits.length));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, portraits.length]);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.28em] uppercase text-accent">{eventName}</p>
          <h1 className="page-title mt-3">Gallery</h1>
          <p className="mt-2 text-sm text-muted">
            {portraits.length
              ? `${portraits.length} portrait${portraits.length === 1 ? "" : "s"}`
              : "Portraits will appear here as they finish."}
          </p>
        </div>
        {portraits.length ? (
          <a className="booth-button min-h-11 w-full px-4 text-xs sm:w-auto" href={archiveHref}>
            Download all
          </a>
        ) : null}
      </div>

      {portraits.length ? (
        <div className="client-gallery">
          {portraits.map((portrait, index) => (
            <button key={portrait.id} type="button" className="client-gallery-card" onClick={() => setOpen(index)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={portrait.thumb} alt={portrait.themeTitle} />
              <span>{portrait.themeTitle}</span>
            </button>
          ))}
        </div>
      ) : null}

      {current ? (
        <div className="client-gallery-lightbox" role="dialog" aria-modal="true" aria-label={current.themeTitle}>
          <button type="button" className="client-gallery-backdrop" aria-label="Close" onClick={() => setOpen(null)} />
          <div className="client-gallery-stage">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.src} alt={current.themeTitle} />
            <div className="client-gallery-actions">
              <p>{current.themeTitle}</p>
              <div className="flex flex-wrap gap-2">
                <a className="booth-button min-h-11 px-4 text-xs" href={current.src} download={current.filename}>
                  Download
                </a>
                <button type="button" className="booth-button-secondary min-h-11 px-4 text-xs" onClick={() => setOpen(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
