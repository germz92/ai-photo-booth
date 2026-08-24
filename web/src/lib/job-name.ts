import { getDocument, oidValue, runMongoCommand, setDocumentFields } from "./prisma";

export function readStoredName(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function setJobGuestFields(
  id: string,
  fields: { name?: string | null; manualUpload?: boolean },
) {
  const next: Record<string, unknown> = {};
  if (fields.name !== undefined) next.name = fields.name || "";
  if (fields.manualUpload) next.manualUpload = true;
  if (Object.keys(next).length) await setDocumentFields("Job", id, next);
}

export async function setJobName(id: string, name: string | null) {
  await setJobGuestFields(id, { name });
}

export async function getJobName(id: string, fallback?: string | null) {
  if (fallback) return fallback;
  const doc = await getDocument<{ name?: unknown }>("Job", id);
  return readStoredName(doc?.name);
}

export async function getJobManualUpload(id: string) {
  const doc = await getDocument<{ manualUpload?: unknown }>("Job", id);
  return doc?.manualUpload === true;
}

export async function attachJobNames<T extends { id: string; name?: string | null; manualUpload?: boolean }>(
  jobs: T[],
) {
  if (!jobs.length) return jobs;
  const found = await runMongoCommand<{
    cursor?: { firstBatch?: Array<{ _id?: unknown; name?: unknown; manualUpload?: unknown }> };
  }>({
    find: "Job",
    filter: { _id: { $in: jobs.map((job) => ({ $oid: job.id })) } },
    projection: { _id: 1, name: 1, manualUpload: 1 },
    limit: jobs.length,
  });
  const extras = new Map<string, { name: string | null; manualUpload: boolean }>();
  for (const row of found.cursor?.firstBatch || []) {
    extras.set(oidValue(row._id), {
      name: readStoredName(row.name),
      manualUpload: row.manualUpload === true,
    });
  }
  for (const job of jobs) {
    const extra = extras.get(job.id);
    job.name = extra?.name ?? job.name ?? null;
    job.manualUpload = extra?.manualUpload ?? job.manualUpload ?? false;
  }
  return jobs;
}
