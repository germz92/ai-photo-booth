"use client";

import { useEffect, useState } from "react";
import { mediaVersion } from "./queue";

export type LightboxItem = {
  src: string;
  filename: string;
  label: string;
};

export type LightboxState = {
  items: LightboxItem[];
  index: number;
};

export function jobMediaSrc(
  jobId: string,
  options: {
    which?: "output" | "original";
    i?: number;
    size?: "thumb";
    v?: string | number | Date;
  } = {},
) {
  const params = new URLSearchParams();
  params.set("which", options.which || "output");
  if ((options.which || "output") === "output") params.set("i", String(options.i ?? 0));
  if (options.size) params.set("size", options.size);
  const version = mediaVersion(options.v);
  if (version) params.set("v", version);
  return `/api/admin/jobs/${jobId}/media?${params}`;
}

export function outputLightbox(
  jobId: string,
  outputCount: number,
  index: number,
  v?: string | number | Date,
): LightboxState {
  return {
    index,
    items: Array.from({ length: Math.max(1, outputCount) }, (_, itemIndex) => ({
      src: jobMediaSrc(jobId, { which: "output", i: itemIndex, v }),
      filename: `portrait-${jobId}-${itemIndex + 1}.jpg`,
      label: `Portrait ${itemIndex + 1}`,
    })),
  };
}

export function captureLightbox(jobId: string, v?: string | number | Date): LightboxState {
  return {
    index: 0,
    items: [
      {
        src: jobMediaSrc(jobId, { which: "original", v }),
        filename: `capture-${jobId}.jpg`,
        label: "Capture",
      },
    ],
  };
}

export function MediaLightbox({
  items,
  index,
  onClose,
  onIndexChange,
  zIndex,
}: {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  zIndex?: number;
}) {
  const [downloading, setDownloading] = useState(false);
  const current = items[index];
  const canNav = items.length > 1;

  function go(delta: number) {
    if (!canNav) return;
    onIndexChange((index + delta + items.length) % items.length);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (!canNav) return;
      if (event.key === "ArrowLeft") onIndexChange((index - 1 + items.length) % items.length);
      if (event.key === "ArrowRight") onIndexChange((index + 1) % items.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canNav, index, items.length, onClose, onIndexChange]);

  async function download() {
    if (!current) return;
    setDownloading(true);
    try {
      const response = await fetch(`${current.src}${current.src.includes("?") ? "&" : "?"}download=1`);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = current.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  if (!current) return null;

  return (
    <div className="lightbox" style={zIndex ? { zIndex } : undefined} onClick={onClose} role="presentation">
      <div className="lightbox-stage" onClick={(event) => event.stopPropagation()} role="dialog" aria-label={current.label}>
        {canNav ? (
          <button type="button" className="lightbox-nav prev" aria-label="Previous image" onClick={() => go(-1)}>
            ‹
          </button>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.src} alt={current.label} />
        {canNav ? (
          <button type="button" className="lightbox-nav next" aria-label="Next image" onClick={() => go(1)}>
            ›
          </button>
        ) : null}
      </div>
      <div className="lightbox-toolbar" onClick={(event) => event.stopPropagation()}>
        <p className="lightbox-caption">
          {current.label}
          {canNav ? ` · ${index + 1} / ${items.length}` : ""}
        </p>
        <button type="button" className="booth-button min-h-11 px-4 text-xs" disabled={downloading} onClick={() => void download()}>
          {downloading ? "Saving…" : "Download"}
        </button>
        <button type="button" className="booth-button-secondary min-h-11 px-4 text-xs" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
