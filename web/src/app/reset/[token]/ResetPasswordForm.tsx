"use client";

import { useEffect, useState, type FormEvent } from "react";

export function ResetPasswordForm({ token }: { token: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch(`/api/reset?token=${encodeURIComponent(token)}`);
      const json = (await response.json()) as { email?: string; error?: string };
      if (cancelled) return;
      if (!response.ok) {
        setError(json.error || "Invalid or expired reset link");
        return;
      }
      setEmail(json.email || "");
      setReady(true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    setError("");
    const response = await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const json = (await response.json()) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      setError(json.error || "Could not reset password");
      return;
    }
    window.location.href = "/admin/login";
  }

  if (!ready && error) {
    return <p className="text-sm text-red-300">{error}</p>;
  }
  if (!ready) {
    return <p className="text-sm text-muted">Checking reset link…</p>;
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => void onSubmit(event)}>
      <p className="text-sm text-muted">{email}</p>
      <label className="grid gap-1 text-sm">
        New password
        <input
          className="booth-input"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          required
        />
      </label>
      <label className="grid gap-1 text-sm">
        Confirm password
        <input
          className="booth-input"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          minLength={8}
          required
        />
      </label>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <button type="submit" className="booth-button w-full" disabled={busy}>
        {busy ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
