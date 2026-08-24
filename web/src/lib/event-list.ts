import { getEventBranding } from "./prisma";

export type EventListItem = {
  id: string;
  name: string;
  eventDate: string;
  status: string;
  _count: { themes: number; jobs: number };
  hasLogo: boolean;
  logoVersion: string;
};

export async function toEventListItem(event: {
  id: string;
  name: string;
  eventDate: Date | string;
  status: string;
  _count: { themes: number; jobs: number };
}): Promise<EventListItem> {
  const branding = await getEventBranding(event.id);
  const eventDate =
    event.eventDate instanceof Date ? event.eventDate.toISOString() : String(event.eventDate);
  return {
    id: event.id,
    name: event.name,
    eventDate,
    status: event.status,
    _count: event._count,
    hasLogo: Boolean(branding.wallLogoKey),
    logoVersion: branding.wallLogoKey.split("/").pop() || "",
  };
}

export async function toEventListItems(
  events: Array<{
    id: string;
    name: string;
    eventDate: Date | string;
    status: string;
    _count: { themes: number; jobs: number };
  }>,
) {
  return Promise.all(events.map(toEventListItem));
}
