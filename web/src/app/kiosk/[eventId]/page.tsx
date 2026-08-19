import { notFound, redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { CaptureBooth } from "@/components/CaptureBooth";
import { userOwnsEvent } from "@/lib/access";
import { eventAllowsUpload, prisma } from "@/lib/prisma";
import { getUserAccount } from "@/lib/users";

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
    await signOut({ redirectTo: "/admin/login" });
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
        select: { id: true, title: true },
      },
    },
  });
  if (!event || event.status === "archived") notFound();

  return (
    <CaptureBooth
      eventId={event.id}
      eventName={event.name}
      allowUpload={await eventAllowsUpload(event.id)}
      themes={event.themes}
      credits={account.credits}
    />
  );
}
