"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type GridFit = {
  cols: number;
  rows: number;
  tileW: number;
  tileH: number;
  gap: number;
};

const PORTRAIT_RATIO = 832 / 1216;

function fitPortraitGrid(width: number, height: number): GridFit {
  const gap = Math.max(8, Math.round(Math.min(width, height) * 0.01));
  const landscape = width >= height;
  const minCols = landscape ? 5 : 3;
  const maxCols = landscape ? 8 : 5;
  const fallback: GridFit = { cols: minCols, rows: 1, tileW: 160, tileH: 160 / PORTRAIT_RATIO, gap };

  if (width < 80 || height < 80) return fallback;

  let best: GridFit & { score: number } = { ...fallback, score: -1 };

  for (let cols = minCols; cols <= maxCols; cols++) {
    const tileW = (width - gap * (cols - 1)) / cols;
    if (tileW < 96) continue;
    const tileH = tileW / PORTRAIT_RATIO;
    const rows = Math.floor((height + gap) / (tileH + gap));
    if (rows < 1) continue;
    const usedW = cols * tileW + (cols - 1) * gap;
    const usedH = rows * tileH + (rows - 1) * gap;
    if (usedW > width + 1 || usedH > height + 1) continue;
    const fill = (usedW * usedH) / (width * height);
    const score = fill * tileW * rows;
    if (score > best.score) best = { cols, rows, tileW, tileH, gap, score };
  }

  if (best.score < 0) {
    const cols = minCols;
    let tileW = (width - gap * (cols - 1)) / cols;
    let tileH = tileW / PORTRAIT_RATIO;
    let rows = Math.max(1, Math.floor((height + gap) / (tileH + gap)));
    const neededH = rows * tileH + (rows - 1) * gap;
    if (neededH > height) {
      tileH = (height - gap * (rows - 1)) / rows;
      tileW = tileH * PORTRAIT_RATIO;
    }
    return { cols, rows, tileW, tileH, gap };
  }

  return { cols: best.cols, rows: best.rows, tileW: best.tileW, tileH: best.tileH, gap: best.gap };
}

export function EventWall({
  eventId,
  eventName,
  wallTitle,
  showWallTitle,
  hasLogo,
  logoVersion,
}: {
  eventId: string;
  eventName: string;
  wallTitle: string;
  showWallTitle: boolean;
  hasLogo: boolean;
  logoVersion: string;
}) {
  const [portraits, setPortraits] = useState<Portrait[]>([]);
  const [title, setTitle] = useState(showWallTitle ? wallTitle.trim() || eventName : "");
  const [showTitle, setShowTitle] = useState(showWallTitle);
  const [logo, setLogo] = useState(hasLogo);
  const [version, setVersion] = useState(logoVersion);
  const [error, setError] = useState("");
  const seen = useRef(new Set<string>());
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState<Set<string>>(new Set());
  const gridRef = useRef<HTMLElement>(null);
  const [grid, setGrid] = useState<GridFit>({ cols: 6, rows: 2, tileW: 240, tileH: 240 / PORTRAIT_RATIO, gap: 10 });

  function markReady(id: string) {
    setReady((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch(`/api/e/${eventId}/wall`, { cache: "no-store" });
      const json = (await response.json()) as {
        portraits?: Portrait[];
        event?: {
          name?: string;
          wallTitle?: string;
          showWallTitle?: boolean;
          hasLogo?: boolean;
          logoVersion?: string;
        };
        error?: string;
      };
      if (cancelled) return;
      if (!response.ok) {
        setError(json.error || "Could not load wall");
        return;
      }
      const next = json.portraits || [];
      const newcomers = new Set<string>();
      for (const portrait of next) {
        if (seen.current.size > 0 && !seen.current.has(portrait.id)) {
          newcomers.add(portrait.id);
        }
        seen.current.add(portrait.id);
      }
      setPortraits(next);
      const visibleTitle = json.event?.showWallTitle !== false;
      setShowTitle(visibleTitle);
      setTitle(visibleTitle ? (json.event?.wallTitle || "").trim() || json.event?.name || eventName : "");
      setLogo(Boolean(json.event?.hasLogo));
      setVersion(json.event?.logoVersion || "");
      setError("");
      if (newcomers.size > 0) {
        setFresh(newcomers);
        window.setTimeout(() => {
          setFresh((current) => {
            const updated = new Set(current);
            for (const id of newcomers) updated.delete(id);
            return updated;
          });
        }, 8000);
      }
    }

    void load();
    const timer = window.setInterval(() => void load(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [eventId, eventName]);

  useEffect(() => {
    const node = gridRef.current;
    if (!node) return undefined;

    function measure() {
      const box = gridRef.current;
      if (!box) return;
      const styles = window.getComputedStyle(box);
      const padX = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
      const padY = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
      setGrid(fitPortraitGrid(box.clientWidth - padX, box.clientHeight - padY));
    }

    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(node);
    return () => observer.disconnect();
  }, [portraits.length, logo, showTitle, title]);

  return (
    <main className="wall-page">
      {logo || (showTitle && title) ? (
        <header className="wall-header">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/e/${eventId}/logo?v=${version}`}
              alt=""
            />
          ) : null}
          {showTitle && title ? <h1>{title}</h1> : null}
        </header>
      ) : null}

      {error ? <p className="px-8 text-red-300">{error}</p> : null}

      {portraits.length === 0 && !error ? (
        <p className="flex flex-1 items-center justify-center px-8 text-xl text-muted">
          Portraits will appear here as guests finish.
        </p>
      ) : (
        <section
          ref={gridRef}
          className="wall-grid"
          style={
            {
              "--wall-cols": String(grid.cols),
              "--wall-tile-w": `${grid.tileW}px`,
              "--wall-tile-h": `${grid.tileH}px`,
              "--wall-gap": `${grid.gap}px`,
            } as CSSProperties
          }
        >
          {portraits.slice(0, grid.cols * grid.rows).map((portrait, index) => {
            const loaded = ready.has(portrait.id);
            const isNew = fresh.has(portrait.id) && loaded;
            return (
              <figure
                key={portrait.id}
                className={`wall-tile${loaded ? " is-ready" : ""}${isNew ? " wall-tile-new" : ""}`}
                style={
                  isNew
                    ? ({ "--wall-delay": `${Math.min(index, 6) * 90}ms` } as CSSProperties)
                    : undefined
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={portrait.src}
                  alt={portrait.themeTitle}
                  onLoad={() => markReady(portrait.id)}
                  ref={(node) => {
                    if (node?.complete && node.naturalWidth > 0) markReady(portrait.id);
                  }}
                />
              </figure>
            );
          })}
        </section>
      )}
    </main>
  );
}
