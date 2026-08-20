import { EventNav } from "./EventNav";
import { EventSettingsLink } from "./EventSettingsLink";
import { loadAdminEvent } from "./load-event";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await loadAdminEvent(id);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10">
      <div>
        <a href="/admin" className="text-sm text-muted underline">
          All events
        </a>
        <div className="mt-3 flex items-start justify-between gap-3">
          <h1 className="page-title min-w-0">{event.name}</h1>
          <EventSettingsLink eventId={event.id} />
        </div>
      </div>
      <EventNav eventId={event.id} jobCount={event._count.jobs} status={event.status} />
      {children}
    </main>
  );
}
