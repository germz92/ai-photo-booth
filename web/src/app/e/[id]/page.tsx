import { notFound } from "next/navigation";
import { getEventBranding, prisma } from "@/lib/prisma";
import { EventWall } from "./EventWall";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function EventWallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!event) notFound();
  const branding = await getEventBranding(id);

  return (
    <EventWall
      eventId={event.id}
      eventName={event.name}
      wallTitle={branding.wallTitle}
      showWallTitle={branding.showWallTitle}
      hasLogo={Boolean(branding.wallLogoKey)}
      logoVersion={branding.wallLogoKey.split("/").pop() || ""}
    />
  );
}
