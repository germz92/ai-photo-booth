"use client";

import { useState } from "react";

export type CaptureState = {
  enabled: boolean;
  pinSet: boolean;
  pin: string | null;
  slug: string | null;
  path: string | null;
  url: string | null;
};

function shareUrl(path: string | null, fallback: string | null) {
  if (typeof window !== "undefined" && path) return `${window.location.origin}${path}`;
  return fallback || "";
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75">
      {open ? (
        <>
          <path strokeLinecap="round" d="M3 3l18 18" />
          <path d="M9.9 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.2 3.8" />
          <path d="M6.1 6.1A17.6 17.6 0 0 0 2 12s3.5 7 10 7a10.4 10.4 0 0 0 4.2-.9" />
        </>
      ) : (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

export function CaptureSettings({
  eventId,
  eventName,
  initial,
  compact = false,
}: {
  eventId: string;
  eventName: string;
  initial: CaptureState;
  compact?: boolean;
}) {
  const [capture, setCapture] = useState(initial);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const link = shareUrl(capture.path, capture.url);

  async function save(body: { enabled?: boolean; pin?: string; rotateLink?: boolean }, okMessage: string) {
    setBusy("Saving");
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/events/${eventId}/capture`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as { capture?: CaptureState; error?: string };
      if (!response.ok || !json.capture) throw new Error(json.error || "Could not save capture settings");
      setCapture(json.capture);
      setPin("");
      setShowPin(false);
      setNotice(okMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save capture settings");
    } finally {
      setBusy("");
    }
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy the link");
    }
  }

  return (
    <div className={`grid gap-4 ${compact ? "" : "max-w-2xl gap-6"}`}>
      {compact ? null : (
        <div>
          <h2 className="text-xl font-light tracking-[0.08em] uppercase">Capture settings</h2>
          <p className="mt-2 text-sm text-muted">
            Create a shared kiosk link for {eventName}. Anyone with the link and PIN can capture or
            upload photos into this event. Submissions use your account credits.
          </p>
        </div>
      )}

      <div className="grid gap-2">
        <p className="booth-label">Shared kiosk</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`kiosk-theme-btn is-compact min-w-20 ${capture.enabled ? "selected" : ""}`}
            disabled={Boolean(busy)}
            onClick={() => {
              if (!capture.pinSet && pin.length < 4) {
                setError("Set a 4 to 8 digit PIN before enabling the shared kiosk.");
                return;
              }
              void save({ enabled: true, pin: pin || undefined }, "Shared kiosk enabled");
            }}
          >
            Enabled
          </button>
          <button
            type="button"
            className={`kiosk-theme-btn is-compact min-w-20 ${capture.enabled ? "" : "selected"}`}
            disabled={Boolean(busy)}
            onClick={() => void save({ enabled: false }, "Shared kiosk disabled")}
          >
            Disabled
          </button>
        </div>
        <p className="text-sm text-muted">Guests use this link and PIN. The operator kiosk still needs your admin login.</p>
      </div>

      <div className="grid gap-2">
        <p className="booth-label">PIN</p>
        <div className="flex flex-wrap items-center gap-2">
          {capture.pin ? (
            <div className="inline-flex items-center gap-1">
              <span className="min-w-[5.5rem] font-mono text-sm tracking-[0.28em]">
                {showPin ? capture.pin : "•".repeat(capture.pin.length)}
              </span>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded text-muted hover:text-foreground"
                aria-label={showPin ? "Hide PIN" : "Show PIN"}
                title={showPin ? "Hide PIN" : "Show PIN"}
                onClick={() => setShowPin((current) => !current)}
              >
                <EyeIcon open={showPin} />
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted">
              {capture.pinSet ? "PIN is set. Enter a new one to change it." : "4 to 8 digits"}
            </p>
          )}
          <input
            className="booth-input is-compact max-w-[9rem] tracking-[0.28em]"
            inputMode="numeric"
            autoComplete="off"
            pattern="\d{4,8}"
            maxLength={8}
            value={pin}
            onChange={(change) => setPin(change.target.value.replace(/\D/g, "").slice(0, 8))}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (pin.length >= 4) void save({ pin }, "PIN saved");
            }}
            placeholder={capture.pinSet ? "New PIN" : "1234"}
            aria-label={capture.pinSet ? "New PIN" : "PIN"}
          />
          <button
            type="button"
            className="booth-button is-compact"
            disabled={Boolean(busy) || pin.length < 4}
            onClick={() => void save({ pin }, "PIN saved")}
          >
            {capture.pinSet ? "Update" : "Save"}
          </button>
        </div>
      </div>

      <div className="grid gap-2">
        <p className="booth-label">Shareable link</p>
        {capture.path ? (
          <>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <p className="min-w-0 w-full truncate rounded border border-white/10 bg-black/30 px-3 py-1.5 text-sm sm:flex-1">
                {link || capture.path}
              </p>
              <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="booth-button is-compact"
                disabled={!capture.enabled}
                onClick={() => void copyLink()}
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <a className="booth-button-secondary is-compact" href={capture.path} target="_blank" rel="noreferrer">
                Open
              </a>
              <button
                type="button"
                className="booth-button-secondary is-compact"
                disabled={Boolean(busy)}
                onClick={() => {
                  if (!window.confirm("Create a new link? The current URL will stop working.")) return;
                  void save({ rotateLink: true }, "New link created");
                }}
              >
                Rotate
              </button>
              </div>
            </div>
            {!capture.enabled ? (
              <p className="text-sm text-muted">Enable the shared kiosk before guests can use this link.</p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted">Save a PIN and enable the shared kiosk to generate a link.</p>
        )}
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {notice && !error ? <p className="text-sm text-accent">{notice}</p> : null}
      {busy ? <p className="text-sm text-muted">{busy}…</p> : null}
    </div>
  );
}
