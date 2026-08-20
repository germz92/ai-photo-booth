"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const requested = params.get("callbackUrl") || "/admin";
    const callbackUrl =
      requested.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\")
        ? requested
        : "/admin";
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    if (result?.error) {
      setError("Invalid email or password");
      setBusy(false);
      return;
    }
    window.location.assign(callbackUrl);
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => void onSubmit(event)}>
      <label className="grid gap-1 text-sm">
        Email
        <input
          className="booth-input"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label className="grid gap-1 text-sm">
        Password
        <input
          className="booth-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <button type="submit" className="booth-button" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
