export type QueueJob = {
  id: string;
  status: string;
  email: string | null;
  phone: string | null;
  emailStatus: string;
  smsStatus: string;
  error: string | null;
  createdAt: string;
  themeId: string;
  prompt: string;
  hasOriginal: boolean;
  outputCount: number;
  resultToken: string;
};

export function toQueueJob(job: {
  id: string;
  status: string;
  email: string | null;
  phone: string | null;
  emailStatus: string;
  smsStatus: string;
  error: string | null;
  createdAt: Date | string;
  themeId: string;
  prompt?: string | null;
  originalKey?: string | null;
  outputKey?: string | null;
  outputKeys?: string[];
  hasOriginal?: boolean;
  outputCount?: number;
  resultToken?: string | null;
}): QueueJob {
  return {
    id: job.id,
    status: job.status,
    email: job.email,
    phone: job.phone,
    emailStatus: job.emailStatus,
    smsStatus: job.smsStatus,
    error: job.error,
    createdAt: typeof job.createdAt === "string" ? job.createdAt : job.createdAt.toISOString(),
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
