import { redirect } from "next/navigation";
import { listOwnedEventIds, requireUser } from "@/lib/access";
import { toEventListItems } from "@/lib/event-list";
import { prisma } from "@/lib/prisma";
import { EventList } from "./EventList";

export default async function AdminHomePage() {
  const session = await requireUser();
  if (!session) redirect("/admin/login");
  const ids = await listOwnedEventIds(session.user.id);
  const events = ids.length
    ? await prisma.event.findMany({
        where: { id: { in: ids } },
        orderBy: { eventDate: "desc" },
        include: { _count: { select: { themes: true, jobs: true } } },
      })
    : [];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      <div>
        <h1 className="page-title">Events</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Create an event, add themes, then open that event’s kiosk from settings.
        </p>
      </div>
      <EventList initialEvents={await toEventListItems(events)} />
    </main>
  );
}
