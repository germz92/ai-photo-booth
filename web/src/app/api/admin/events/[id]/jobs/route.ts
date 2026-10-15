import { requireOwnedEvent } from "@/lib/access";
import { deleteEventJobs, JOB_PAGE_SIZE, listEventJobs, type JobListFilter } from "@/lib/event-jobs";

export const runtime = "nodejs";

const FILTERS: JobListFilter[] = ["all", "processing", "complete", "failed"];

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedEvent(id);
  if (!access.ok) return access.response;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "all";
  const listed = await listEventJobs(id, {
    q: url.searchParams.get("q") || "",
    status: FILTERS.includes(status as JobListFilter) ? (status as JobListFilter) : "all",
    cursor: url.searchParams.get("cursor") || undefined,
    limit: Number(url.searchParams.get("limit") || JOB_PAGE_SIZE) || JOB_PAGE_SIZE,
    themeId: url.searchParams.get("themeId") || undefined,
  });
  return Response.json(listed);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedEvent(id);
  if (!access.ok) return access.response;

  const body = (await request.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((value): value is string => typeof value === "string") : [];
  if (!ids.length) return Response.json({ error: "Choose submissions to delete" }, { status: 400 });

  const deleted = await deleteEventJobs(id, ids);
  return Response.json({ deleted });
}
