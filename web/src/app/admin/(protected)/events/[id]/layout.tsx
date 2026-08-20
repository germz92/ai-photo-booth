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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <div>
        <a href="/admin" className="text-sm text-muted underline">
          All events
        </a>
        <div className="mt-3 flex items-center justify-between gap-4">
          <h1 className="text-3xl font-light tracking-[0.12em] uppercase">{event.name}</h1>
          <EventSettingsLink eventId={event.id} />
        </div>
      </div>
      <EventNav eventId={event.id} jobCount={event._count.jobs} status={event.status} />
      {children}
    </main>
  );
}
