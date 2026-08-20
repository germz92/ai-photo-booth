import { jobOutputKeys } from "@/lib/jobs";
import { getEventBranding, prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const WALL_LIMIT = 80;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!event) return Response.json({ error: "Not found" }, { status: 404 });

  const branding = await getEventBranding(id);
  const jobs = await prisma.job.findMany({
    where: { eventId: id, status: "complete", outputKey: { not: null } },
    orderBy: { createdAt: "desc" },
    take: WALL_LIMIT,
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      outputKey: true,
      outputKeys: true,
      theme: { select: { title: true } },
    },
  });

  const portraits = jobs
    .flatMap((job) =>
      jobOutputKeys(job).map((_, index) => ({
        id: `${job.id}-${index}`,
        themeTitle: job.theme.title,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        src: `/api/e/${id}/wall/${job.id}?i=${index}&size=thumb&v=${job.updatedAt.getTime()}`,
      })),
    )
    .slice(0, WALL_LIMIT);

  return Response.json({
    event: {
      id: event.id,
      name: event.name,
      wallTitle: branding.wallTitle,
      showWallTitle: branding.showWallTitle,
      hasLogo: Boolean(branding.wallLogoKey),
      logoVersion: branding.wallLogoKey.split("/").pop() || "",
    },
    portraits,
  });
}
