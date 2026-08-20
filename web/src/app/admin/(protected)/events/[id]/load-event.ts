import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { requireUser, userOwnsEvent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { attachThemeLooks } from "@/lib/theme-looks-db";

export const loadAdminEvent = cache(async (id: string) => {
  const session = await requireUser();
  if (!session) redirect("/admin/login");
  if (!(await userOwnsEvent(session.user.id, id))) notFound();

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      themes: { orderBy: { sortOrder: "asc" } },
      _count: { select: { jobs: true } },
    },
  });
  if (!event) notFound();
  return { ...event, themes: await attachThemeLooks(event.themes) };
});
