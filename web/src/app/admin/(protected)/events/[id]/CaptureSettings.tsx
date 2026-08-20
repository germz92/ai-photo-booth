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
  const [copiedPin, setCopiedPin] = useState(false);

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

  async function copyPin() {
    if (!capture.pin) return;
    try {
      await navigator.clipboard.writeText(capture.pin);
      setCopiedPin(true);
      window.setTimeout(() => setCopiedPin(false), 1600);
    } catch {
      setError("Could not copy the PIN");
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
    <div className={`grid gap-6 ${compact ? "" : "max-w-2xl gap-8"}`}>
      {compact ? null : (
      <div>
        <h2 className="text-xl font-light tracking-[0.08em] uppercase">Capture settings</h2>
        <p className="mt-2 text-sm text-muted">
          Create a shared kiosk link for {eventName}. Anyone with the link and PIN can capture or
          upload photos into this event. Submissions use your account credits.
        </p>
      </div>
      )}

      <section className="grid gap-3 rounded border border-white/10 bg-[var(--panel)] p-6 md:col-span-3">
        <p className="booth-label">Shared kiosk</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`kiosk-theme-btn min-w-24 ${capture.enabled ? "selected" : ""}`}
            disabled={Boolean(busy)}
            onClick={() => {
              if (!capture.pinSet && pin.length < 4) {
                setError("Set a 4 to 8 digit PIN before enabling the shared kiosk.");
                return;
              }
              void save(
                { enabled: true, pin: pin || undefined },
                "Shared kiosk enabled",
              );
            }}
          >
            Enabled
          </button>
          <button
            type="button"
            className={`kiosk-theme-btn min-w-24 ${capture.enabled ? "" : "selected"}`}
            disabled={Boolean(busy)}
            onClick={() => void save({ enabled: false }, "Shared kiosk disabled")}
          >
            Disabled
          </button>
        </div>
        <p className="text-sm text-muted">
          When enabled, guests can open the link on their own phone or a spare iPad. The operator
          kiosk still requires your admin login.
        </p>
      </section>

      <section className="grid gap-3 rounded border border-white/10 bg-[var(--panel)] p-6">
        <p className="booth-label">PIN</p>
        {capture.pin ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="booth-input max-w-xs tracking-[0.3em]">
              {showPin ? capture.pin : "•".repeat(capture.pin.length)}
            </p>
            <button
              type="button"
              className="booth-button-secondary min-h-10 px-4 text-xs"
              onClick={() => setShowPin((current) => !current)}
            >
              {showPin ? "Hide" : "Show"}
            </button>
            <button type="button" className="booth-button-secondary min-h-10 px-4 text-xs" onClick={() => void copyPin()}>
              {copiedPin ? "Copied" : "Copy PIN"}
            </button>
          </div>
        ) : capture.pinSet ? (
          <p className="text-sm text-muted">PIN is set. Save it again below to show it here.</p>
        ) : (
          <p className="text-sm text-muted">Set a 4 to 8 digit PIN for the shared kiosk.</p>
        )}
        <label className="grid gap-2">
          <span className="text-sm text-muted">{capture.pinSet ? "Change PIN" : "New PIN"}</span>
          <input
            className="booth-input max-w-xs tracking-[0.3em]"
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
            placeholder={capture.pinSet ? "••••" : "1234"}
          />
        </label>
        <button
          type="button"
          className="booth-button justify-self-start min-h-10 px-4 text-xs"
          disabled={Boolean(busy) || pin.length < 4}
          onClick={() => void save({ pin }, "PIN saved")}
        >
          {capture.pinSet ? "Update PIN" : "Save PIN"}
        </button>
      </section>

      <section className="grid gap-3 rounded border border-white/10 bg-[var(--panel)] p-6">
        <p className="booth-label">Shareable link</p>
        {capture.path ? (
          <>
            <p className="break-all rounded border border-white/10 bg-black/30 px-3 py-3 text-sm">{link || capture.path}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="booth-button min-h-10 px-4 text-xs"
                disabled={!capture.enabled}
                onClick={() => void copyLink()}
              >
                {copied ? "Copied" : "Copy link"}
              </button>
              <a
                className="booth-button-secondary min-h-10 px-4 text-xs"
                href={capture.path}
                target="_blank"
                rel="noreferrer"
              >
                Open
              </a>
              <button
                type="button"
                className="booth-button-secondary min-h-10 px-4 text-xs"
                disabled={Boolean(busy)}
                onClick={() => {
                  if (!window.confirm("Create a new link? The current URL will stop working.")) return;
                  void save({ rotateLink: true }, "New link created");
                }}
              >
                Rotate link
              </button>
            </div>
            {!capture.enabled ? (
              <p className="text-sm text-muted">Enable the shared kiosk before guests can use this link.</p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted">Save a PIN and enable the shared kiosk to generate a link.</p>
        )}
      </section>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {notice && !error ? <p className="text-sm text-accent">{notice}</p> : null}
      {busy ? <p className="text-sm text-muted">{busy}…</p> : null}
    </div>
  );
}
