"use client";

import { useState, type FormEvent } from "react";

export function KioskUnlockForm({
  kioskHref,
  nextHref,
}: {
  kioskHref: string;
  nextHref: string;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/kiosk/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Incorrect password");
      window.location.href = nextHref;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect password");
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-16 text-center sm:px-6">
      <p className="text-xs tracking-[0.28em] uppercase text-accent">Kiosk locked</p>
      <h1 className="page-title mt-3">Operator access</h1>
      <p className="mt-3 text-sm text-muted">
        This iPad is in kiosk mode. Enter the operator password to open admin, or return to the booth.
      </p>
      <form className="mt-8 grid gap-4 text-left" onSubmit={(form) => void submit(form)}>
        <label className="grid gap-2">
          <span className="booth-label">Password</span>
          <input
            className="booth-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(change) => setPassword(change.target.value)}
            required
          />
        </label>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <button type="submit" className="booth-button w-full" disabled={busy || !password}>
          {busy ? "Unlocking…" : "Unlock admin"}
        </button>
      </form>
      <a className="mt-6 text-sm text-muted underline" href={kioskHref}>
        Return to booth
      </a>
    </main>
  );
}
