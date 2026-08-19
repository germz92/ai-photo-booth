import { listEventJobs } from "@/lib/event-jobs";
import { loadAdminEvent } from "./load-event";
import { SubmissionQueue } from "./SubmissionQueue";

export default async function EventQueuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [event, listed] = await Promise.all([loadAdminEvent(id), listEventJobs(id)]);
  const themesById = Object.fromEntries(event.themes.map((theme) => [theme.id, { title: theme.title }]));

  return (
    <SubmissionQueue
      eventId={event.id}
      initialJobs={listed.jobs}
      initialNextCursor={listed.nextCursor}
      initialCounts={listed.counts}
      themesById={themesById}
    />
  );
}
