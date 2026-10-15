import { jobOutputKeys } from "./jobs";
import { prisma } from "./prisma";

export type GalleryPortrait = {
  id: string;
  themeTitle: string;
  thumb: string;
  src: string;
  filename: string;
};

export type GalleryFile = GalleryPortrait & {
  key: string;
};

function slug(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "portrait"
  );
}

function extensionFor(key: string) {
  if (key.endsWith(".webp")) return "webp";
  if (key.endsWith(".png")) return "png";
  return "jpg";
}

export function galleryArchiveName(eventName: string) {
  return `${slug(eventName) || "event"}-gallery.zip`;
}

export async function listEventGallery(eventId: string): Promise<GalleryFile[]> {
  const jobs = await prisma.job.findMany({
    where: { eventId, status: "complete", outputKey: { not: null } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      updatedAt: true,
      outputKey: true,
      outputKeys: true,
      theme: { select: { title: true } },
    },
  });

  const portraits: GalleryFile[] = [];
  for (const job of jobs) {
    const keys = jobOutputKeys(job);
    keys.forEach((key, index) => {
      const n = String(portraits.length + 1).padStart(3, "0");
      const version = job.updatedAt.getTime();
      portraits.push({
        id: `${job.id}-${index}`,
        themeTitle: job.theme.title,
        thumb: `/api/e/${eventId}/wall/${job.id}?i=${index}&size=thumb&v=${version}`,
        src: `/api/e/${eventId}/wall/${job.id}?i=${index}&v=${version}`,
        filename: `${n}-${slug(job.theme.title)}.${extensionFor(key)}`,
        key,
      });
    });
  }
  return portraits;
}
