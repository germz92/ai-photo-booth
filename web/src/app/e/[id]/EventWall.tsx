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
const MIN_WALL_COLS = 2;
const MAX_WALL_COLS = 12;
const WALL_COLS_KEY = (eventId: string) => `lumetry-wall-cols:${eventId}`;
const CHROME_IDLE_MS = 2500;

type Portrait = {
  id: string;
  themeTitle: string;
  createdAt: string;
  src: string;
};

function layoutForCols(width: number, height: number, cols: number, gap: number): GridFit {
  const count = Math.min(MAX_WALL_COLS, Math.max(MIN_WALL_COLS, cols));
  let tileW = (width - gap * (count - 1)) / count;
  let tileH = tileW / PORTRAIT_RATIO;
  let rows = Math.max(1, Math.floor((height + gap) / (tileH + gap)));
  const neededH = rows * tileH + (rows - 1) * gap;
  if (neededH > height) {
    tileH = (height - gap * (rows - 1)) / rows;
    tileW = tileH * PORTRAIT_RATIO;
  }
  return { cols: count, rows, tileW, tileH, gap };
}

function fitPortraitGrid(width: number, height: number, preferredCols?: number | null): GridFit {
  const gap = Math.max(8, Math.round(Math.min(width, height) * 0.01));
  const landscape = width >= height;
  const minCols = landscape ? 5 : 3;
  const maxCols = landscape ? 8 : 5;
  const fallback: GridFit = { cols: minCols, rows: 1, tileW: 160, tileH: 160 / PORTRAIT_RATIO, gap };

  if (width < 80 || height < 80) {
    return preferredCols ? layoutForCols(160 * preferredCols, 160, preferredCols, gap) : fallback;
  }

  if (preferredCols) return layoutForCols(width, height, preferredCols, gap);

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

  if (best.score < 0) return layoutForCols(width, height, minCols, gap);

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
  const idleTimer = useRef<number>(0);
  const overControls = useRef(false);
  const [grid, setGrid] = useState<GridFit>({ cols: 6, rows: 2, tileW: 240, tileH: 240 / PORTRAIT_RATIO, gap: 10 });
  const [colsOverride, setColsOverride] = useState<number | null>(null);
  const [chromeVisible, setChromeVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
      setGrid(fitPortraitGrid(box.clientWidth - padX, box.clientHeight - padY, colsOverride));
    }

    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(node);
    return () => observer.disconnect();
  }, [portraits.length, logo, showTitle, title, colsOverride]);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(WALL_COLS_KEY(eventId)));
    if (Number.isInteger(stored) && stored >= MIN_WALL_COLS && stored <= MAX_WALL_COLS) {
      setColsOverride(stored);
    }
  }, [eventId]);

  useEffect(() => {
    function hide() {
      if (overControls.current) return;
      setChromeVisible(false);
    }

    function show() {
      setChromeVisible(true);
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(hide, CHROME_IDLE_MS);
    }

    window.addEventListener("mousemove", show);
    window.addEventListener("pointerdown", show);
    return () => {
      window.clearTimeout(idleTimer.current);
      window.removeEventListener("mousemove", show);
      window.removeEventListener("pointerdown", show);
    };
  }, []);

  function setCols(next: number) {
    const cols = Math.min(MAX_WALL_COLS, Math.max(MIN_WALL_COLS, next));
    setColsOverride(cols);
    window.localStorage.setItem(WALL_COLS_KEY(eventId), String(cols));
  }

  const cols = colsOverride ?? grid.cols;

  return (
    <main className="wall-page">
      <div
        className={`wall-chrome${chromeVisible ? " is-visible" : ""}`}
        onMouseEnter={() => {
          overControls.current = true;
          window.clearTimeout(idleTimer.current);
          setChromeVisible(true);
        }}
        onMouseLeave={() => {
          overControls.current = false;
          window.clearTimeout(idleTimer.current);
          idleTimer.current = window.setTimeout(() => setChromeVisible(false), CHROME_IDLE_MS);
        }}
      >
        {settingsOpen ? (
          <div className="wall-cols-control" role="group" aria-label="Images per row">
            <button
              type="button"
              className="wall-chrome-btn"
              aria-label="Fewer images per row"
              disabled={cols <= MIN_WALL_COLS}
              onClick={() => setCols(cols - 1)}
            >
              −
            </button>
            <span className="wall-cols-count">{cols}</span>
            <button
              type="button"
              className="wall-chrome-btn"
              aria-label="More images per row"
              disabled={cols >= MAX_WALL_COLS}
              onClick={() => setCols(cols + 1)}
            >
              +
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className={`wall-chrome-btn wall-settings-btn${settingsOpen ? " is-open" : ""}`}
          aria-label="Wall settings"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75">
            <circle cx="12" cy="12" r="3" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
            />
          </svg>
        </button>
      </div>
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
