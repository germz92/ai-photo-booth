import { requireOwnedJob } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedJob(id);
  if (!access.ok) return access.response;
  const job = await prisma.job.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      emailStatus: true,
      smsStatus: true,
      error: true,
      createdAt: true,
    },
  });
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(job);
}
