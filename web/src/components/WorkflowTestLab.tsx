"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { OptimizePromptButton } from "./OptimizePromptButton";

type Defaults = {
  configured: boolean;
  endpointSet: boolean;
  qwenPrompt: string;
};

export function WorkflowTestLab() {
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  const [qwenPrompt, setQwenPrompt] = useState("");
  const [batch, setBatch] = useState(4);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [results, setResults] = useState<Array<{ filename: string; url: string }>>([]);
  const submitSeq = useRef(0);

  useEffect(() => {
    void fetch("/api/test/defaults")
      .then((response) => response.json())
      .then((json: Defaults) => {
        setDefaults(json);
        setQwenPrompt(json.qwenPrompt || "");
      })
      .catch(() => setError("Could not load workflow defaults"));
  }, []);

  useEffect(() => {
    if (!jobId) return undefined;
    const id = jobId;
    let cancelled = false;

    async function tick() {
      const response = await fetch(`/api/test/status?id=${encodeURIComponent(id)}`);
      const json = (await response.json()) as {
        status?: string;
        error?: string;
        images?: Array<{ filename: string; url: string }>;
      };
      if (cancelled) return;
      if (!response.ok) {
        setError(json.error || "Status check failed");
        setBusy(false);
        return;
      }
      setStatus(json.status || "");
      if (json.status === "COMPLETED") {
        setResults(json.images || []);
        setBusy(false);
      }
      if (json.status === "FAILED" || json.status === "CANCELLED" || json.status === "TIMED_OUT") {
        setError(json.error || json.status || "Job failed");
        setBusy(false);
      }
    }

    void tick();
    const timer = window.setInterval(() => {
      void tick();
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [jobId]);

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0];
    event.target.value = "";
    if (!next) return;
    submitSeq.current += 1;
    setFile(next);
    setResults([]);
    setJobId(null);
    setBusy(false);
    setStatus("");
    setError("");
    const reader = new FileReader();
    reader.onload = () => setPreview(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file || busy) {
      if (!file) setError("Choose a test photo first.");
      return;
    }
    const seq = ++submitSeq.current;
    setBusy(true);
    setError("");
    setResults([]);
    setJobId(null);
    setStatus("SUBMITTING");
    const form = new FormData();
    form.append("photo", file);
    form.append("qwenPrompt", qwenPrompt);
    form.append("batch", String(batch));
    const response = await fetch("/api/test/run", { method: "POST", body: form });
    const json = (await response.json()) as { id?: string; error?: string; mocked?: boolean };
    if (seq !== submitSeq.current) return;
    if (!response.ok || !json.id) {
      setError(json.error || "Could not start job");
      setBusy(false);
      return;
    }
    if (json.mocked) {
      setError("MOCK_RUNPOD is on and the live submit was mocked. Set MOCK_RUNPOD=false.");
      setBusy(false);
      return;
    }
    setJobId(json.id);
    setStatus("IN_QUEUE");
  }

  return (
    <main className="mx-auto flex min-h-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.28em] uppercase text-accent">Workflow test</p>
          <h1 className="mt-2 text-2xl font-medium tracking-tight sm:text-3xl">Run one job</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Uploads a photo to your RunPod endpoint. Edit the Qwen stage prompt below. Keys come from
            web/.env — nothing is typed on this page.
          </p>
        </div>
        <a className="booth-button-secondary min-h-11 w-full px-4 text-xs sm:w-auto" href="/admin">
          Admin
        </a>
      </header>

      {defaults && !defaults.configured ? (
        <p className="border border-red-400/40 px-4 py-3 text-sm text-red-300">
          Missing RUNPOD_API_KEY or RUNPOD_ENDPOINT_ID in web/.env. Add them and restart{" "}
          <code>npm run dev</code>.
        </p>
      ) : null}

      <form className="grid gap-8 lg:grid-cols-2" onSubmit={(event) => void onSubmit(event)}>
        <section className="grid gap-4">
          <label className="grid gap-2 text-sm">
            Test photo
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} />
          </label>
          <div className="min-h-64 overflow-hidden bg-black ring-1 ring-white/10">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Test input" className="max-h-[28rem] w-full object-contain" />
            ) : (
              <p className="flex h-64 items-center justify-center text-sm text-muted">No photo yet</p>
            )}
          </div>
          {file ? <p className="text-xs text-muted">{file.name}</p> : null}
        </section>

        <section className="grid gap-4">
          <div className="grid gap-2 text-sm">
            <span className="flex items-center justify-between gap-3">
              Qwen prompt (node 284)
              <OptimizePromptButton value={qwenPrompt} onChange={setQwenPrompt} disabled={busy} />
            </span>
            <textarea
              className="booth-input min-h-72 py-3"
              value={qwenPrompt}
              onChange={(event) => setQwenPrompt(event.target.value)}
            />
          </div>
          <label className="grid gap-2 text-sm">
            <span className="flex items-center justify-between">
              Batch
              <span className="tabular-nums text-accent">{batch}</span>
            </span>
            <input
              type="range"
              min={1}
              max={4}
              step={1}
              value={batch}
              disabled={busy}
              onChange={(event) => setBatch(Number(event.target.value))}
            />
            <span className="text-xs text-muted">1–4 images per request</span>
          </label>
          <button type="submit" className="booth-button justify-self-start" disabled={busy}>
            {busy ? "Running…" : "Run workflow"}
          </button>
          {status ? (
            <p className="text-sm text-muted">
              Status: <span className="text-foreground">{status}</span>
              {jobId ? (
                <>
                  {" "}
                  · job <code className="text-xs">{jobId}</code>
                </>
              ) : null}
            </p>
          ) : null}
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
        </section>
      </form>

      {results.length > 0 ? (
        <section className="grid gap-4">
          <h2 className="text-xl font-medium">Results ({results.length})</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {results.map((image, index) => (
              <figure key={`${jobId}-${image.filename}-${index}`} className="grid gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={image.filename} className="w-full bg-black ring-1 ring-white/10" />
                <a className="text-sm text-accent underline" href={image.url} download={image.filename}>
                  Download {image.filename}
                </a>
              </figure>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
