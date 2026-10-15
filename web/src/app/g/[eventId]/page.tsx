import { notFound } from "next/navigation";
import { listEventGallery } from "@/lib/gallery";
import { prisma } from "@/lib/prisma";
import { ClientGallery } from "./ClientGallery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ClientGalleryPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  if (!/^[a-f0-9]{24}$/i.test(eventId)) notFound();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true },
  });
  if (!event) notFound();

  const portraits = (await listEventGallery(event.id)).map(({ key: _key, ...portrait }) => portrait);

  return (
    <ClientGallery
      eventName={event.name}
      portraits={portraits}
      archiveHref={`/api/g/${event.id}/archive`}
    />
  );
}
