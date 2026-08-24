import { notFound } from "next/navigation";
import { ThemeSampleViewer } from "@/components/ThemeSampleViewer";
import { prisma } from "@/lib/prisma";
import { attachThemeLooks } from "@/lib/theme-looks-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SampleStylesPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  if (!/^[a-f0-9]{24}$/i.test(eventId)) notFound();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      status: true,
      themes: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true, prompt: true },
      },
    },
  });
  if (!event || event.status === "archived") notFound();

  const themes = (await attachThemeLooks(event.themes)).map((theme) => ({
    id: theme.id,
    title: theme.title,
    splitLooks: theme.splitLooks,
    hasPreview: theme.hasPreview,
    hasMasculinePreview: theme.hasMasculinePreview,
    hasFemininePreview: theme.hasFemininePreview,
    previewVersion: theme.previewVersion,
  }));

  return <ThemeSampleViewer eventName={event.name} themes={themes} />;
}
