import { attachJobNames } from "./job-name";
import { prisma, runMongoCommand } from "./prisma";
import { toQueueJob, type QueueJob } from "@/app/admin/(protected)/events/[id]/queue";

export const JOB_PAGE_SIZE = 24;
export const PROCESSING_STATUSES = ["queued", "submitted", "processing"] as const;

export type JobListFilter = "all" | "processing" | "complete" | "failed";

export type JobCounts = {
  all: number;
  processing: number;
  complete: number;
  failed: number;
  matched: number;
};

function oidValue(value: unknown) {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && "$oid" in value) {
    return String((value as { $oid: string }).$oid || "");
  }
  return "";
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseCursor(cursor: string | undefined) {
  if (!cursor) return null;
  const split = cursor.lastIndexOf("|");
  if (split <= 0) return null;
  const createdAt = new Date(cursor.slice(0, split));
  const id = cursor.slice(split + 1);
  if (Number.isNaN(createdAt.getTime()) || !id) return null;
  return { createdAt, id };
}

export function jobCursor(job: { id: string; createdAt: string | Date }) {
  const createdAt = typeof job.createdAt === "string" ? job.createdAt : job.createdAt.toISOString();
  return `${createdAt}|${job.id}`;
}

async function matchingThemeIds(eventId: string, q: string) {
  const themes = await prisma.theme.findMany({
    where: { eventId },
    select: { id: true, title: true },
  });
  const needle = q.toLowerCase();
  return themes.filter((theme) => theme.title.toLowerCase().includes(needle)).map((theme) => theme.id);
}

async function jobFilter(
  eventId: string,
  options: { q?: string; status?: JobListFilter; cursor?: string; themeId?: string },
) {
  const filter: Record<string, unknown> = { eventId: { $oid: eventId } };
  if (options.status === "complete") filter.status = "complete";
  if (options.status === "failed") filter.status = "failed";
  if (options.status === "processing") filter.status = { $in: [...PROCESSING_STATUSES] };
  if (options.themeId && /^[a-f0-9]{24}$/i.test(options.themeId)) {
    filter.themeId = { $oid: options.themeId };
  }

  const clauses: Record<string, unknown>[] = [];
  const q = options.q?.trim();
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: "i" };
    const themeIds = await matchingThemeIds(eventId, q);
    const searchOr: Record<string, unknown>[] = [
      { name: rx },
      { email: rx },
      { phone: rx },
      { prompt: rx },
      { status: rx },
      { resultToken: rx },
      { error: rx },
    ];
    if (themeIds.length) {
      searchOr.push({ themeId: { $in: themeIds.map((id) => ({ $oid: id })) } });
    }
    if (/^[a-f0-9]{24}$/i.test(q)) searchOr.push({ _id: { $oid: q } });
    clauses.push({ $or: searchOr });
  }

  const cursor = parseCursor(options.cursor);
  if (cursor) {
    clauses.push({
      $or: [
        { createdAt: { $lt: { $date: cursor.createdAt.toISOString() } } },
        {
          createdAt: { $eq: { $date: cursor.createdAt.toISOString() } },
          _id: { $lt: { $oid: cursor.id } },
        },
      ],
    });
  }

  if (clauses.length === 1) Object.assign(filter, clauses[0]);
  if (clauses.length > 1) filter.$and = clauses;
  return filter;
}

async function countJobs(query: Record<string, unknown>) {
  const result = await runMongoCommand<{ n?: number }>({
    count: "Job",
    query,
  });
  return Number(result.n) || 0;
}

export async function eventJobCounts(eventId: string): Promise<Omit<JobCounts, "matched">> {
  const where = { eventId };
  const [all, complete, failed, processing] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.count({ where: { ...where, status: "complete" } }),
    prisma.job.count({ where: { ...where, status: "failed" } }),
    prisma.job.count({ where: { ...where, status: { in: [...PROCESSING_STATUSES] } } }),
  ]);
  return { all, complete, failed, processing };
}

export async function listEventJobs(
  eventId: string,
  options: { q?: string; status?: JobListFilter; cursor?: string; limit?: number; themeId?: string } = {},
) {
  const limit = Math.min(50, Math.max(1, options.limit || JOB_PAGE_SIZE));
  const [filter, counts] = await Promise.all([
    jobFilter(eventId, options),
    eventJobCounts(eventId),
  ]);
  const matchedFilter = await jobFilter(eventId, {
    q: options.q,
    status: options.status,
    themeId: options.themeId,
  });
  const matched = await countJobs(matchedFilter);

  const found = await runMongoCommand<{ cursor?: { firstBatch?: Array<{ _id?: unknown }> } }>({
    find: "Job",
    filter,
    sort: { createdAt: -1, _id: -1 },
    limit: limit + 1,
    projection: { _id: 1 },
  });

  const ids = (found.cursor?.firstBatch || []).map((row) => oidValue(row._id)).filter(Boolean);
  const hasMore = ids.length > limit;
  const pageIds = hasMore ? ids.slice(0, limit) : ids;
  const records = pageIds.length
    ? await prisma.job.findMany({ where: { id: { in: pageIds } } })
    : [];
  const byId = new Map(records.map((job) => [job.id, job]));
  const jobs = pageIds
    .map((id) => {
      const job = byId.get(id);
      return job ? toQueueJob(job) : null;
    })
    .filter((job): job is QueueJob => Boolean(job));
  await attachJobNames(jobs);

  const nextCursor = hasMore && jobs.length ? jobCursor(jobs[jobs.length - 1]) : null;
  return {
    jobs,
    nextCursor,
    counts: { ...counts, matched },
  };
}
