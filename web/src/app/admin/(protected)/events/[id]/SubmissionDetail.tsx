"use client";

import { useEffect, useState } from "react";
import { captureLightbox, MediaLightbox, outputLightbox, type LightboxState } from "./MediaLightbox";
import { QrCodeImage } from "@/components/QrCodeImage";

export type JobDetail = {
  id: string;
  status: string;
  email: string | null;
  phone: string | null;
  prompt: string;
  batch: number;
  themeId: string;
  themeTitle: string;
  emailStatus: string;
  smsStatus: string;
  emailError: string | null;
  smsError: string | null;
  error: string | null;
  createdAt: string;
  hasOriginal: boolean;
  outputCount: number;
  resultUrl: string;
};

export function SubmissionDetail({
  jobId,
  onClose,
  onChanged,
}: {
  jobId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [prompt, setPrompt] = useState("");
  const [batch, setBatch] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [copied, setCopied] = useState(false);

  async function parseJson(response: Response) {
    const text = await response.text();
    if (!text) return { error: response.statusText || "Empty response" };
    try {
      return JSON.parse(text) as { job?: JobDetail; error?: string };
    } catch {
      return { error: text.slice(0, 200) };
    }
  }

  async function load() {
    const response = await fetch(`/api/admin/jobs/${jobId}`);
    const json = await parseJson(response);
    if (!response.ok || !json.job) {
      setError(json.error || "Could not load submission");
      return;
    }
    setJob(json.job);
    setEmail(json.job.email || "");
    setPhone(json.job.phone || "");
    setPrompt(json.job.prompt || "");
    setBatch(json.job.batch || 1);
  }

  useEffect(() => {
    void load();
  }, [jobId]);

  async function saveContact() {
    setBusy("save");
    setError("");
    const response = await fetch(`/api/admin/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone, prompt, batch }),
    });
    const json = await parseJson(response);
    setBusy("");
    if (!response.ok) {
      setError(json.error || "Could not save");
      return;
    }
    await load();
    onChanged();
  }

  async function resend() {
    setBusy("resend");
    setError("");
    const saveResponse = await fetch(`/api/admin/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone, prompt, batch }),
    });
    if (!saveResponse.ok) {
      const json = await parseJson(saveResponse);
      setBusy("");
      setError(json.error || "Could not save before resend");
      return;
    }
    const response = await fetch(`/api/jobs/${jobId}/resend`, {
      method: "POST",
      body: "{}",
    });
    const json = await parseJson(response);
    setBusy("");
    if (!response.ok) {
      setError(json.error || "Could not resend");
      return;
    }
    await load();
    onChanged();
  }

  async function regenerate() {
    setBusy("regen");
    setError("");
    const saveResponse = await fetch(`/api/admin/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone, prompt, batch }),
    });
    if (!saveResponse.ok) {
      const json = await parseJson(saveResponse);
      setBusy("");
      setError(json.error || "Could not save before regenerate");
      return;
    }
    const response = await fetch(`/api/admin/jobs/${jobId}/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, batch }),
    });
    const json = await parseJson(response);
    setBusy("");
    if (!response.ok) {
      setError(json.error || "Could not regenerate");
      return;
    }
    await load();
    onChanged();
  }

  return (
    <div className="lightbox" onClick={onClose} role="presentation">
      <div
        className="detail-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Submission details"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.28em] uppercase text-accent">Submission</p>
            <h2 className="mt-2 text-2xl font-light tracking-[0.08em] uppercase">
              {job?.themeTitle || "Details"}
            </h2>
            {job ? (
              <p className="mt-1 text-xs text-muted">{new Date(job.createdAt).toLocaleString()}</p>
            ) : null}
          </div>
          <button type="button" className="booth-button-secondary min-h-10 px-3 text-xs" onClick={onClose}>
            Close
          </button>
        </div>

        {!job ? (
          <p className="mt-8 text-sm text-muted">{error || "Loading…"}</p>
        ) : (
          <div className="mt-6 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
            <div className="grid content-start gap-4">
              {job.outputCount > 0 ? (
                <div className={`submission-hero ${job.outputCount === 1 ? "single" : "multi"}`}>
                  {Array.from({ length: job.outputCount }, (_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setLightbox(outputLightbox(job.id, job.outputCount, index))}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/admin/jobs/${job.id}/media?which=output&i=${index}&size=thumb`}
                        alt={`Portrait ${index + 1}`}
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">No generated portraits yet.</p>
              )}
              <div className="flex items-end gap-3">
                {job.hasOriginal ? (
                  <button
                    type="button"
                    className="shrink-0"
                    title="Original capture"
                    onClick={() => setLightbox(captureLightbox(job.id))}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/admin/jobs/${job.id}/media?which=original&size=thumb`}
                      alt="Original capture"
                      className="submission-thumb"
                    />
                    <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-muted">
                      Capture
                    </span>
                  </button>
                ) : null}
                <div className="min-w-0 pb-1">
                  <span className={`submission-status ${job.status === "complete" ? "complete" : job.status === "failed" ? "failed" : "processing"}`}>
                    {job.status}
                  </span>
                  {job.error ? <p className="mt-2 text-sm text-[var(--danger)]">{job.error}</p> : null}
                </div>
              </div>
            </div>

            <div className="grid gap-5">
              <label className="grid gap-2">
                <span className="booth-label">Email</span>
                <input className="booth-input" value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label className="grid gap-2">
                <span className="booth-label">Mobile</span>
                <input className="booth-input" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </label>
              <p className="-mt-2 text-xs text-muted">
                email {job.emailStatus}
                {job.emailError ? ` (${job.emailError})` : ""} · sms {job.smsStatus}
                {job.smsError ? ` (${job.smsError})` : ""}
              </p>
              {job.resultUrl ? (
                <div className="grid gap-3 rounded border border-white/10 p-4">
                  <span className="booth-label">Guest link</span>
                  <div className="flex items-start gap-4">
                    <div className="grid min-w-0 flex-1 gap-3">
                      <p className="break-all text-sm text-white">{job.resultUrl}</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="booth-button-secondary min-h-10 px-4 text-xs"
                          onClick={() => {
                            void navigator.clipboard.writeText(job.resultUrl);
                            setCopied(true);
                            window.setTimeout(() => setCopied(false), 1500);
                          }}
                        >
                          {copied ? "Copied" : "Copy link"}
                        </button>
                        <a
                          className="booth-button-secondary min-h-10 px-4 text-xs"
                          href={job.resultUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                      </div>
                    </div>
                    <QrCodeImage value={job.resultUrl} size={112} alt="Guest portrait link" />
                  </div>
                </div>
              ) : null}
              <label className="grid gap-2">
                <span className="booth-label">Prompt</span>
                <textarea
                  className="booth-input min-h-32 py-3"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                />
              </label>
              <div className="grid gap-2">
                <span className="booth-label">Batch</span>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`kiosk-theme-btn min-w-14 ${batch === value ? "selected" : ""}`}
                      onClick={() => setBatch(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
              <div className="grid gap-2 pt-1">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="booth-button-secondary min-h-10 px-4 text-xs"
                    disabled={Boolean(busy)}
                    onClick={() => void saveContact()}
                  >
                    {busy === "save" ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    className="booth-button-secondary min-h-10 px-4 text-xs"
                    disabled={Boolean(busy) || job.status !== "complete"}
                    onClick={() => void resend()}
                  >
                    {busy === "resend" ? "Sending…" : "Resend email/SMS"}
                  </button>
                </div>
                <button
                  type="button"
                  className="booth-button min-h-10 px-4 text-xs"
                  disabled={Boolean(busy)}
                  onClick={() => void regenerate()}
                >
                  {busy === "regen" ? "Starting…" : "Regenerate portraits"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {lightbox ? (
        <MediaLightbox
          items={lightbox.items}
          index={lightbox.index}
          zIndex={60}
          onClose={() => setLightbox(null)}
          onIndexChange={(index) => setLightbox((current) => (current ? { ...current, index } : current))}
        />
      ) : null}
    </div>
  );
}
