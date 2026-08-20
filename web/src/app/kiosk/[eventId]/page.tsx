import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { CaptureBooth } from "@/components/CaptureBooth";
import { userOwnsEvent } from "@/lib/access";
import { eventAllowsUpload, prisma } from "@/lib/prisma";
import { attachThemeLooks } from "@/lib/theme-looks-db";
import { getUserAccount } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function KioskPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/admin/login?callbackUrl=${encodeURIComponent(`/kiosk/${eventId}`)}`);
  }
  const account = await getUserAccount(session.user.id);
  if (!account || account.status !== "active") {
    redirect("/admin/login");
  }
  if (!(await userOwnsEvent(session.user.id, eventId))) notFound();

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
      credits={account.credits}
    />
  );
}
