"use client";

import { useState, type FormEvent } from "react";

export function KioskUnlockForm({
  kioskHref,
  nextHref,
  email,
}: {
  kioskHref: string;
  nextHref: string;
  email?: string;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"unlock" | "logout" | "">("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy("unlock");
    setError("");
    try {
      const response = await fetch("/api/kiosk/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Incorrect password");
      window.location.href = nextHref;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect password");
      setPassword("");
      setBusy("");
    }
  }

  async function logout() {
    setBusy("logout");
    setError("");
    try {
      const response = await fetch("/api/kiosk/logout", { method: "POST" });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Could not log out");
      window.location.href = "/admin/login";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log out");
      setBusy("");
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-16 text-center sm:px-6">
      <p className="text-xs tracking-[0.28em] uppercase text-accent">Kiosk locked</p>
      <h1 className="page-title mt-3">Operator access</h1>
      <p className="mt-3 text-sm text-muted">
        {email ? (
          <>
            Signed in as <span className="text-foreground">{email}</span>. Enter that password to open the event list.
          </>
        ) : (
          "Enter the operator password to open the event list."
        )}
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
        <button type="submit" className="booth-button w-full" disabled={Boolean(busy) || !password}>
          {busy === "unlock" ? "Unlocking…" : "Unlock admin"}
        </button>
        <button
          type="button"
          className="booth-button-secondary w-full"
          disabled={Boolean(busy)}
          onClick={() => void logout()}
        >
          {busy === "logout" ? "Signing out…" : "Log out"}
        </button>
      </form>
      <a className="mt-6 text-sm text-muted underline" href={kioskHref}>
        Return to booth
      </a>
    </main>
  );
}
