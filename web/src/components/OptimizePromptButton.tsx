"use client";

import { useState } from "react";

export async function requestOptimizedPrompt(body: {
  prompt: string;
  look?: "masculine" | "feminine";
  hint?: string;
  adaptLook?: boolean;
}) {
  const response = await fetch("/api/admin/prompts/optimize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as { prompt?: string; error?: string };
  if (!response.ok || !json.prompt) throw new Error(json.error || "Could not optimize prompt");
  return json.prompt;
}

export function OptimizePromptButton({
  value,
  onChange,
  look,
  hint,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  look?: "masculine" | "feminine";
  hint?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function optimize() {
    setBusy(true);
    setError("");
    try {
      onChange(await requestOptimizedPrompt({ prompt: value, look, hint }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not optimize prompt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        className="booth-button-secondary is-compact"
        disabled={disabled || busy || (!value.trim() && !hint?.trim())}
        onClick={() => void optimize()}
      >
        {busy ? "Optimizing…" : "Optimize"}
      </button>
      {error ? <span className="max-w-56 text-right text-xs text-[var(--danger)]">{error}</span> : null}
    </span>
  );
}

export function AutoAdaptLooksButton({
  source,
  hint,
  disabled,
  onMasculine,
  onFeminine,
}: {
  source: string;
  hint?: string;
  disabled?: boolean;
  onMasculine: (next: string) => void;
  onFeminine: (next: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function adapt() {
    setBusy(true);
    setError("");
    try {
      const [masculine, feminine] = await Promise.all([
        requestOptimizedPrompt({ prompt: source, look: "masculine", hint, adaptLook: true }),
        requestOptimizedPrompt({ prompt: source, look: "feminine", hint, adaptLook: true }),
      ]);
      onMasculine(masculine);
      onFeminine(feminine);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not adapt looks");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        className="booth-button-secondary is-compact"
        disabled={disabled || busy || !source.trim()}
        onClick={() => void adapt()}
      >
        {busy ? "Adapting…" : "Auto adapt"}
      </button>
      {error ? <span className="max-w-64 text-right text-xs text-[var(--danger)]">{error}</span> : null}
    </span>
  );
}
