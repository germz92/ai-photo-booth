"use client";

import { useState, type FormEvent } from "react";

export function CapturePinGate({
  eventName,
  slug,
}: {
  eventName: string;
  slug: string;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/c/${encodeURIComponent(slug)}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Incorrect PIN");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect PIN");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <p className="text-xs tracking-[0.28em] uppercase text-accent">{eventName}</p>
      <h1 className="page-title mt-4">Enter PIN</h1>
      <p className="mt-3 max-w-md text-muted">This shared kiosk is PIN protected.</p>
      <form className="mt-8 grid w-full max-w-xs gap-4" onSubmit={(form) => void submit(form)}>
        <label className="grid gap-2 text-left">
          <span className="booth-label">PIN</span>
          <input
            className="booth-input text-center tracking-[0.4em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{4,8}"
            maxLength={8}
            value={pin}
            onChange={(change) => setPin(change.target.value.replace(/\D/g, "").slice(0, 8))}
            required
          />
        </label>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <button type="submit" className="booth-button w-full" disabled={busy || pin.length < 4}>
          {busy ? "Checking…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
