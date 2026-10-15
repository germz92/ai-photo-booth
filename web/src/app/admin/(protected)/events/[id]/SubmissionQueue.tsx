"use client";

import { useEffect, useRef, useState } from "react";
import { ManualUpload, type QueueTheme } from "./ManualUpload";
import { captureLightbox, jobMediaSrc, MediaLightbox, outputLightbox, type LightboxState } from "./MediaLightbox";
import { SubmissionDetail } from "./SubmissionDetail";
import { mediaVersion, type QueueJob } from "./queue";
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
  themes,
}: {
  eventId: string;
  initialJobs: QueueJob[];
  initialNextCursor: string | null;
  initialCounts: JobCounts;
  themesById: Record<string, { title: string }>;
  themes: QueueTheme[];
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [counts, setCounts] = useState(initialCounts);
  const [filter, setFilter] = useState<JobListFilter>("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
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
    const response = await fetch(`/api/admin/events/${eventId}/jobs?${params}`, { cache: "no-store" });
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
    setSelected([]);
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

  function toggleSelected(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  const shownIds = jobs.map((job) => job.id);
  const allShownSelected = shownIds.length > 0 && shownIds.every((id) => selected.includes(id));

  async function deleteSelected() {
    if (!selected.length || deleting) return;
    const count = selected.length;
    if (!window.confirm(`Delete ${count} submission${count === 1 ? "" : "s"}? This removes the portraits.`)) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/admin/events/${eventId}/jobs`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Could not delete submissions");
      const removed = new Set(selected);
      setJobs((current) => current.filter((job) => !removed.has(job.id)));
      setSelected([]);
      if (openId && removed.has(openId)) setOpenId(null);
      const refreshed = await fetchJobs({});
      if (refreshed.jobs) {
        setJobs(refreshed.jobs);
        setNextCursor(refreshed.nextCursor || null);
      }
      if (refreshed.counts) setCounts(refreshed.counts);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete submissions");
    } finally {
      setDeleting(false);
    }
  }

  const matchingLabel = query
    ? `${counts.matched} matching`
    : `${jobs.length}${nextCursor ? "+" : ""} shown`;

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-light tracking-[0.08em] uppercase">Submission queue</h2>
          <p className="mt-1 flex items-center gap-2 text-xs text-accent">
            <span className="pulse-dot" />
            Auto-refresh · {matchingLabel}
          </p>
        </div>
        <div className="filter-pills -mx-1 px-1">
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="booth-input max-w-xl flex-1"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, email, mobile, theme, or prompt"
        />
        <button type="button" className="booth-button-secondary min-h-12 px-4 text-xs" onClick={() => setUploadOpen(true)}>
          Manual upload
        </button>
      </div>

      {jobs.length ? (
        <div className="flex flex-wrap items-center gap-3">
          <label className="submission-select-all">
            <input
              type="checkbox"
              checked={allShownSelected}
              onChange={() => setSelected(allShownSelected ? [] : shownIds)}
            />
            Select shown
          </label>
          {selected.length ? (
            <button
              type="button"
              className="booth-button min-h-10 px-4 text-xs"
              disabled={deleting}
              onClick={() => void deleteSelected()}
            >
              {deleting ? "Deleting…" : `Delete ${selected.length}`}
            </button>
          ) : null}
          {deleteError ? <p className="text-sm text-[var(--danger)]">{deleteError}</p> : null}
        </div>
      ) : null}

      {loading && jobs.length === 0 ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-muted">
          {query ? "No submissions match this search." : "No submissions in this filter."}
        </p>
      ) : (
        <div className="submissions-grid">
          {jobs.map((job) => (
            <article key={job.id} className={`submission-card${selected.includes(job.id) ? " is-selected" : ""}`}>
              <label className="submission-check">
                <input
                  type="checkbox"
                  checked={selected.includes(job.id)}
                  aria-label={`Select ${job.name || "guest"}`}
                  onChange={() => toggleSelected(job.id)}
                />
              </label>
              <div className={`submission-media${isProcessing(job.status) ? " is-generating" : ""}`}>
                {job.outputCount > 0 ? (
                  <div className={`submission-hero ${job.outputCount === 1 ? "single" : "multi"}`}>
                    {Array.from({ length: job.outputCount }, (_, index) => (
                      <button
                        key={`${mediaVersion(job.updatedAt)}-${index}`}
                        type="button"
                        onClick={() =>
                          setLightbox(outputLightbox(job.id, job.outputCount, index, job.updatedAt))
                        }
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={jobMediaSrc(job.id, {
                            which: "output",
                            i: index,
                            size: "thumb",
                            v: job.updatedAt,
                          })}
                          alt={`Portrait ${index + 1}`}
                        />
                      </button>
                    ))}
                  </div>
                ) : job.hasOriginal ? (
                  <button
                    type="button"
                    className="submission-hero-placeholder"
                    onClick={() => setLightbox(captureLightbox(job.id, job.updatedAt))}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={jobMediaSrc(job.id, { which: "original", size: "thumb", v: job.updatedAt })}
                      alt="Capture"
                    />
                  </button>
                ) : (
                  <div className="submission-hero-placeholder" />
                )}
                {isProcessing(job.status) ? (
                  <span className="generating-label">
                    <span className="pulse-dot" />
                    Generating
                  </span>
                ) : null}
                {job.hasOriginal && job.outputCount > 0 ? (
                  <button
                    type="button"
                    className="submission-capture-pip"
                    title="Original capture"
                    onClick={() => setLightbox(captureLightbox(job.id, job.updatedAt))}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={jobMediaSrc(job.id, { which: "original", size: "thumb", v: job.updatedAt })}
                      alt="Original capture"
                    />
                  </button>
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-white">
                  {job.name || "Guest"}
                  {job.manualUpload ? <span className="submission-manual">Manual</span> : null}
                </p>
                <p className="mt-1 truncate text-xs text-accent">
                  {themesById[job.themeId]?.title || "Theme"}
                </p>
                <p className="mt-1 text-xs text-muted">{new Date(job.createdAt).toLocaleString()}</p>
                <span className={`submission-status ${statusClass(job.status)}`}>{job.status}</span>
                {job.error ? <p className="mt-2 text-xs text-[var(--danger)]">{job.error}</p> : null}
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

      {uploadOpen ? (
        <ManualUpload
          eventId={eventId}
          themes={themes}
          onClose={() => setUploadOpen(false)}
          onCreated={() => {
            setUploadOpen(false);
            void fetchJobs({}).then((json) => {
              if (!json.jobs) return;
              setJobs(json.jobs);
              setNextCursor(json.nextCursor || null);
              if (json.counts) setCounts(json.counts);
            });
          }}
        />
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
