"use client";

import { useEffect, useRef, useState } from "react";
import { captureLightbox, MediaLightbox, outputLightbox, type LightboxState } from "./MediaLightbox";
import { SubmissionDetail } from "./SubmissionDetail";
import type { QueueJob } from "./queue";
import type { JobCounts, JobListFilter } from "@/lib/event-jobs";

function isProcessing(status: string) {
  return status === "submitted" || status === "processing" || status === "queued";
}

function statusClass(status: string) {
  if (status === "complete") return "complete";
  if (status === "failed") return "failed";
  return "processing";
}

export function SubmissionQueue({
  eventId,
  initialJobs,
  initialNextCursor,
  initialCounts,
  themesById,
}: {
  eventId: string;
  initialJobs: QueueJob[];
  initialNextCursor: string | null;
  initialCounts: JobCounts;
  themesById: Record<string, { title: string }>;
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [counts, setCounts] = useState(initialCounts);
  const [filter, setFilter] = useState<JobListFilter>("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const skipFirstFetch = useRef(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  async function fetchJobs(options: { cursor?: string | null; limit?: number }) {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    if (query) params.set("q", query);
    if (options.cursor) params.set("cursor", options.cursor);
    if (options.limit) params.set("limit", String(options.limit));
    const response = await fetch(`/api/admin/events/${eventId}/jobs?${params}`);
    return (await response.json()) as {
      jobs?: QueueJob[];
      nextCursor?: string | null;
      counts?: JobCounts;
      error?: string;
    };
  }

  useEffect(() => {
    if (skipFirstFetch.current && filter === "all" && !query) {
      skipFirstFetch.current = false;
      return;
    }
    skipFirstFetch.current = false;
    let cancelled = false;
    setLoading(true);
    void fetchJobs({})
      .then((json) => {
        if (cancelled || !json.jobs) return;
        setJobs(json.jobs);
        setNextCursor(json.nextCursor || null);
        if (json.counts) setCounts(json.counts);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // fetchJobs is recreated each render; filter/query/eventId are the real inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, filter, query]);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const json = await fetchJobs({});
      if (cancelled || !json.jobs) return;
      setJobs((current) => {
        const latestIds = new Set(json.jobs!.map((job) => job.id));
        const rest = current.filter((job) => !latestIds.has(job.id));
        return [...json.jobs!, ...rest];
      });
      if (json.counts) setCounts(json.counts);
    }
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, filter, query]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const json = await fetchJobs({ cursor: nextCursor });
    if (json.jobs) {
      setJobs((current) => {
        const seen = new Set(current.map((job) => job.id));
        return [...current, ...json.jobs!.filter((job) => !seen.has(job.id))];
      });
      setNextCursor(json.nextCursor || null);
    }
    if (json.counts) setCounts(json.counts);
    setLoadingMore(false);
  }

  async function resend(id: string) {
    await fetch(`/api/jobs/${id}/resend`, { method: "POST", body: "{}" });
  }

  const matchingLabel = query
    ? `${counts.matched} matching`
    : `${jobs.length}${nextCursor ? "+" : ""} shown`;

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-light tracking-[0.08em] uppercase">Submission queue</h2>
          <p className="mt-1 flex items-center gap-2 text-xs text-accent">
            <span className="pulse-dot" />
            Auto-refresh · {matchingLabel}
          </p>
        </div>
        <div className="filter-pills">
          {(["all", "processing", "complete", "failed"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={filter === value ? "active" : ""}
              onClick={() => setFilter(value)}
            >
              {value}
              {value === "processing"
                ? ` ${counts.processing}`
                : value === "complete"
                  ? ` ${counts.complete}`
                  : value === "failed"
                    ? ` ${counts.failed}`
                    : ` ${counts.all}`}
            </button>
          ))}
        </div>
      </div>

      <input
        className="booth-input max-w-xl"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by email, mobile, theme, or prompt"
      />

      {loading && jobs.length === 0 ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-muted">
          {query ? "No submissions match this search." : "No submissions in this filter."}
        </p>
      ) : (
        <div className="submissions-grid">
          {jobs.map((job) => (
            <article key={job.id} className="submission-card">
              <div className="submission-media">
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
                ) : job.hasOriginal ? (
                  <button
                    type="button"
                    className="submission-hero-placeholder"
                    onClick={() => setLightbox(captureLightbox(job.id))}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/admin/jobs/${job.id}/media?which=original&size=thumb`}
                      alt="Capture"
                    />
                    {isProcessing(job.status) ? (
                      <span className="generating-label">
                        <span className="pulse-dot" />
                        Generating
                      </span>
                    ) : null}
                  </button>
                ) : (
                  <div className="submission-hero-placeholder">
                    <span className="generating-label">
                      <span className="pulse-dot" />
                      Generating
                    </span>
                  </div>
                )}
                {job.hasOriginal && job.outputCount > 0 ? (
                  <button
                    type="button"
                    className="submission-capture-pip"
                    title="Original capture"
                    onClick={() => setLightbox(captureLightbox(job.id))}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/admin/jobs/${job.id}/media?which=original&size=thumb`}
                      alt="Original capture"
                    />
                  </button>
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-white">
                  {job.email || job.phone || "QR guest"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {themesById[job.themeId]?.title || "Theme"} ·{" "}
                  {new Date(job.createdAt).toLocaleString()}
                </p>
                <span className={`submission-status ${statusClass(job.status)}`}>{job.status}</span>
                {job.error ? <p className="mt-2 text-xs text-[var(--danger)]">{job.error}</p> : null}
                <p className="mt-2 text-xs text-muted">
                  email {job.emailStatus} · sms {job.smsStatus}
                </p>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="booth-button-secondary min-h-10 flex-1 px-3 text-xs"
                  onClick={() => setOpenId(job.id)}
                >
                  Open
                </button>
                {job.status === "complete" ? (
                  <button
                    type="button"
                    className="booth-button-secondary min-h-10 px-3 text-xs"
                    onClick={() => void resend(job.id)}
                  >
                    Resend
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {nextCursor ? (
        <button
          type="button"
          className="booth-button-secondary justify-self-center px-6"
          disabled={loadingMore}
          onClick={() => void loadMore()}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      ) : null}

      {openId ? (
        <SubmissionDetail
          jobId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => {
            void fetchJobs({}).then((json) => {
              if (!json.jobs) return;
              setJobs((current) => {
                const latestIds = new Set(json.jobs!.map((job) => job.id));
                const rest = current.filter((job) => !latestIds.has(job.id));
                return [...json.jobs!, ...rest];
              });
              if (json.counts) setCounts(json.counts);
            });
          }}
        />
      ) : null}
      {lightbox ? (
        <MediaLightbox
          items={lightbox.items}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndexChange={(index) => setLightbox((current) => (current ? { ...current, index } : current))}
        />
      ) : null}
    </section>
  );
}
