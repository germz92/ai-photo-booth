"use client";

import { useEffect, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";

export function AcceptInviteForm({ token }: { token: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch(`/api/invite?token=${encodeURIComponent(token)}`);
      const json = (await response.json()) as { email?: string; name?: string; error?: string };
      if (cancelled) return;
      if (!response.ok) {
        setError(json.error || "Invalid or expired invite");
        return;
      }
      setEmail(json.email || "");
      setName(json.name || "");
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
    const response = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, name }),
    });
    const json = (await response.json()) as { error?: string; email?: string };
    if (!response.ok) {
      setBusy(false);
      setError(json.error || "Could not activate account");
      return;
    }
    const result = await signIn("credentials", {
      email: json.email || email,
      password,
      redirect: false,
      callbackUrl: "/admin",
    });
    if (result?.error) {
      window.location.href = "/admin/login";
      return;
    }
    window.location.href = "/admin";
  }

  if (!ready && error) {
    return <p className="text-sm text-red-300">{error}</p>;
  }
  if (!ready) {
    return <p className="text-sm text-muted">Checking invite…</p>;
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => void onSubmit(event)}>
      <p className="text-sm text-muted">{email}</p>
      <label className="grid gap-1 text-sm">
        Name
        <input className="booth-input" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">
        Password
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
        {busy ? "Activating…" : "Set password and continue"}
      </button>
    </form>
  );
}
