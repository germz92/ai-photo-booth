import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { CaptureBooth } from "@/components/CaptureBooth";
import { CapturePinGate } from "@/components/CapturePinGate";
import { userOwnsEvent } from "@/lib/access";
import { findLiveCaptureKiosk, hasCaptureUnlock } from "@/lib/capture-kiosk";
import { eventAllowsUpload, prisma } from "@/lib/prisma";
import { attachThemeLooks } from "@/lib/theme-looks-db";
import { getUserAccount } from "@/lib/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SharedCapturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const kiosk = await findLiveCaptureKiosk(slug);
  if (!kiosk) notFound();

  const session = await auth();
  const ownerPreview = Boolean(session?.user?.id && (await userOwnsEvent(session.user.id, kiosk.eventId)));
  const unlocked = ownerPreview || (await hasCaptureUnlock(kiosk.slug, kiosk.version));
  if (!unlocked) {
    return <CapturePinGate eventName={kiosk.eventName} slug={kiosk.slug} />;
  }

  const [event, account] = await Promise.all([
    prisma.event.findUnique({
      where: { id: kiosk.eventId },
      select: {
        id: true,
        name: true,
        themes: {
          where: { active: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, title: true, prompt: true },
        },
      },
    }),
    getUserAccount(kiosk.ownerId),
  ]);
  if (!event) notFound();

  const themes = (await attachThemeLooks(event.themes)).map(({ id, title, splitLooks }) => ({
    id,
    title,
    splitLooks,
  }));

  return (
    <CaptureBooth
      eventId={event.id}
      eventName={event.name}
      allowUpload={await eventAllowsUpload(event.id)}
      themes={themes}
      credits={account?.credits ?? 0}
      mode="shared"
      jobsPath={`/api/c/${encodeURIComponent(kiosk.slug)}/jobs`}
    />
  );
}
