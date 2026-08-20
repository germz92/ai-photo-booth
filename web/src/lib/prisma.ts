import { PrismaClient } from "@/generated/db";
import { overlayCoordsFromStored } from "./overlay";

const globalForPrisma = globalThis as unknown as { boothPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.boothPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.boothPrisma = prisma;
}

export function oidValue(value: unknown) {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && "$oid" in value) {
    return String((value as { $oid: string }).$oid || "");
  }
  return "";
}

export function mongoDate(value: Date) {
  return { $date: value.toISOString() };
}

function toMongoFieldValue(value: unknown): unknown {
  if (value instanceof Date) return mongoDate(value);
  return value;
}

export async function runMongoCommand<T = Record<string, unknown>>(command: object) {
  return prisma.$runCommandRaw(command as never) as Promise<T>;
}

export async function setDocumentFields(
  collection: string,
  id: string,
  fields: Record<string, unknown>,
) {
  const converted = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, toMongoFieldValue(value)]),
  );
  await runMongoCommand({
    update: collection,
    updates: [
      {
        q: { _id: { $oid: id } },
        u: { $set: converted },
      },
    ],
  });
}

export async function getDocument<T extends Record<string, unknown>>(
  collection: string,
  id: string,
) {
  const filter =
    /^[a-f0-9]{24}$/i.test(id)
      ? { $or: [{ _id: { $oid: id } }, { _id: id }] }
      : { _id: id };
  const result = await runMongoCommand<{ cursor?: { firstBatch?: T[] } }>({
    find: collection,
    filter,
    limit: 1,
  });
  return result.cursor?.firstBatch?.[0] ?? null;
}

export async function getEventBranding(id: string) {
  const doc = await getDocument<{
    allowUpload?: boolean;
    wallTitle?: string;
    wallLogoKey?: string;
    showWallTitle?: boolean;
    overlayEnabled?: boolean;
    overlayLogoKey?: string;
    overlayPlacement?: string;
    overlayScale?: number;
    overlayPadding?: number;
    overlayX?: number;
    overlayY?: number;
    overlaySampleKey?: string;
  }>("Event", id);
  const overlayLogoKey = typeof doc?.overlayLogoKey === "string" ? doc.overlayLogoKey.trim() : "";
  const wallLogoKey = typeof doc?.wallLogoKey === "string" ? doc.wallLogoKey.trim() : "";
  const overlaySampleKey = typeof doc?.overlaySampleKey === "string" ? doc.overlaySampleKey.trim() : "";
  const coords = overlayCoordsFromStored({
    x: doc?.overlayX,
    y: doc?.overlayY,
    placement: doc?.overlayPlacement,
    padding: doc?.overlayPadding,
  });
  return {
    allowUpload: doc?.allowUpload !== false,
    wallTitle: typeof doc?.wallTitle === "string" ? doc.wallTitle.trim() : "",
    wallLogoKey,
    showWallTitle: doc?.showWallTitle !== false,
    overlayEnabled: doc?.overlayEnabled === true,
    overlayLogoKey,
    overlayPlacement: typeof doc?.overlayPlacement === "string" ? doc.overlayPlacement : "top-center",
    overlayScale: typeof doc?.overlayScale === "number" ? doc.overlayScale : 0.18,
    overlayPadding: typeof doc?.overlayPadding === "number" ? doc.overlayPadding : 0.045,
    overlayX: coords.x,
    overlayY: coords.y,
    overlaySampleKey,
    overlaySourceKey: overlayLogoKey || wallLogoKey,
  };
}

export async function eventAllowsUpload(id: string) {
  const branding = await getEventBranding(id);
  return branding.allowUpload;
}

export async function findAdminUserDoc(filter: Record<string, unknown>) {
  const result = await runMongoCommand<{
    cursor?: { firstBatch?: Array<Record<string, unknown> & { email?: string; passwordHash?: string }> };
  }>({
    find: "AdminUser",
    filter,
    limit: 1,
  });
  return result.cursor?.firstBatch?.[0] ?? null;
}

export async function countAdminUsers() {
  const result = await runMongoCommand<{ n?: number }>({
    count: "AdminUser",
    query: {},
  });
  return Number(result.n) || 0;
}

const ADMIN_DATE_FIELDS = ["lastLoginAt", "inviteExpiresAt", "resetExpiresAt"] as const;

export async function repairAdminUserDateFields() {
  for (const field of ADMIN_DATE_FIELDS) {
    await runMongoCommand({
      update: "AdminUser",
      updates: [
        {
          q: { [field]: { $type: "string" } },
          u: [{ $set: { [field]: { $toDate: `$${field}` } } }],
          multi: true,
        },
        {
          q: { [`${field}.$date`]: { $type: "string" } },
          u: [{ $set: { [field]: { $toDate: `$${field}.$date` } } }],
          multi: true,
        },
      ],
    });
  }
}
