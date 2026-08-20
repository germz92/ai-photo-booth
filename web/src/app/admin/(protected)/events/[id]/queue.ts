export type QueueJob = {
  id: string;
  status: string;
  email: string | null;
  phone: string | null;
  emailStatus: string;
  smsStatus: string;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  themeId: string;
  prompt: string;
  hasOriginal: boolean;
  outputCount: number;
  resultToken: string;
};

function isoDate(value: Date | string | undefined) {
  if (!value) return new Date().toISOString();
  return typeof value === "string" ? value : value.toISOString();
}

export function mediaVersion(value: Date | string | number | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (!value) return "";
  const time = typeof value === "string" ? Date.parse(value) : value.getTime();
  return Number.isFinite(time) ? String(time) : "";
}

export function toQueueJob(job: {
  id: string;
  status: string;
  email: string | null;
  phone: string | null;
  emailStatus: string;
  smsStatus: string;
  error: string | null;
  createdAt: Date | string;
  updatedAt?: Date | string | null;
  themeId: string;
  prompt?: string | null;
  originalKey?: string | null;
  outputKey?: string | null;
  outputKeys?: string[];
  hasOriginal?: boolean;
  outputCount?: number;
  resultToken?: string | null;
}): QueueJob {
  const createdAt = isoDate(job.createdAt);
  return {
    id: job.id,
    status: job.status,
    email: job.email,
    phone: job.phone,
    emailStatus: job.emailStatus,
    smsStatus: job.smsStatus,
    error: job.error,
    createdAt,
    updatedAt: isoDate(job.updatedAt || job.createdAt),
    themeId: job.themeId,
    prompt: job.prompt || "",
    hasOriginal: Boolean(job.originalKey ?? job.hasOriginal),
    outputCount: job.outputKeys?.length || (job.outputKey ? 1 : job.outputCount) || 0,
    resultToken: job.resultToken || "",
  };
}

export function guestResultUrl(token: string) {
  if (!token) return "";
  if (typeof window === "undefined") return `/r/${token}`;
  return `${window.location.origin}/r/${token}`;
}
