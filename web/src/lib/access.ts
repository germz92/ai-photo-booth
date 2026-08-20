import { requireAdmin, unauthorized } from "@/lib/admin";
import { getUserAccount } from "@/lib/users";
import { getDocument, oidValue, prisma, runMongoCommand, setDocumentFields } from "@/lib/prisma";

export async function claimUnownedEvents(userId: string) {
  const result = await runMongoCommand<{
    cursor?: { firstBatch?: Array<{ _id?: unknown }> };
  }>({
    find: "AdminUser",
    filter: {},
    sort: { createdAt: 1 },
    limit: 1,
    projection: { _id: 1 },
  });
  const firstId = oidValue(result.cursor?.firstBatch?.[0]?._id);
  if (!firstId || firstId !== userId) return;
  await prisma.$runCommandRaw({
    update: "Event",
    updates: [
      {
        q: {
          $or: [{ userId: { $exists: false } }, { userId: null }, { userId: "" }],
        },
        u: { $set: { userId: { $oid: userId } } },
        multi: true,
      },
    ],
  });
}

export async function setEventOwner(eventId: string, userId: string) {
  await setDocumentFields("Event", eventId, { userId: { $oid: userId } });
}

export async function eventOwnerId(eventId: string) {
  const doc = await getDocument<{ userId?: unknown }>("Event", eventId);
  return oidValue(doc?.userId);
}

export async function userOwnsEvent(userId: string, eventId: string) {
  await claimUnownedEvents(userId);
  const owner = await eventOwnerId(eventId);
  return Boolean(owner) && owner === userId;
}

export async function listOwnedEventIds(userId: string) {
  await claimUnownedEvents(userId);
  const result = (await prisma.$runCommandRaw({
    find: "Event",
    filter: {
      $or: [{ userId }, { userId: { $oid: userId } }],
    },
    projection: { _id: 1 },
  })) as { cursor?: { firstBatch?: Array<{ _id?: unknown }> } };
  return (result.cursor?.firstBatch || []).map((row) => oidValue(row._id)).filter(Boolean);
}

export async function requireUser() {
  const session = await requireAdmin();
  if (!session?.user?.id) return null;
  const account = await getUserAccount(session.user.id);
  if (!account || account.status !== "active") return null;
  return session;
}

export async function requireSuperadmin() {
  const session = await requireUser();
  if (!session) return { ok: false as const, response: unauthorized() };
  const account = await getUserAccount(session.user.id);
  if (account?.role !== "superadmin") {
    return {
      ok: false as const,
      response: Response.json({ error: "Superadmin access required" }, { status: 403 }),
    };
  }
  return { ok: true as const, session, account };
}

export async function requireOwnedEvent(eventId: string) {
  const session = await requireUser();
  if (!session) return { ok: false as const, response: unauthorized() };
  if (!(await userOwnsEvent(session.user.id, eventId))) {
    return { ok: false as const, response: Response.json({ error: "Not found" }, { status: 404 }) };
  }
  return { ok: true as const, session, userId: session.user.id };
}

export async function requireOwnedJob(jobId: string) {
  const session = await requireUser();
  if (!session) return { ok: false as const, response: unauthorized() };
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true, eventId: true } });
  if (!job || !(await userOwnsEvent(session.user.id, job.eventId))) {
    return { ok: false as const, response: Response.json({ error: "Not found" }, { status: 404 }) };
  }
  return { ok: true as const, session, userId: session.user.id, job };
}

export async function requireOwnedTheme(themeId: string) {
  const session = await requireUser();
  if (!session) return { ok: false as const, response: unauthorized() };
  const theme = await prisma.theme.findUnique({
    where: { id: themeId },
    select: { id: true, eventId: true },
  });
  if (!theme || !(await userOwnsEvent(session.user.id, theme.eventId))) {
    return { ok: false as const, response: Response.json({ error: "Not found" }, { status: 404 }) };
  }
  return { ok: true as const, session, userId: session.user.id, theme };
}
