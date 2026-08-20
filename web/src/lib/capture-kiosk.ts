import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { getDocument, oidValue, prisma, runMongoCommand, setDocumentFields } from "./prisma";
import { publicAppUrl } from "./public-url";

export const CAPTURE_COOKIE = "lumetry_capture";
export const CAPTURE_PIN_PATTERN = /^\d{4,8}$/;
const COOKIE_TTL_SECONDS = 12 * 60 * 60;

export type CaptureKioskState = {
  enabled: boolean;
  slug: string;
  pinSet: boolean;
  version: number;
};

type CaptureDoc = {
  _id?: unknown;
  userId?: unknown;
  status?: unknown;
  name?: unknown;
  externalKioskEnabled?: unknown;
  externalKioskSlug?: unknown;
  externalKioskPinHash?: unknown;
  externalKioskVersion?: unknown;
};

export type LiveCaptureKiosk = {
  eventId: string;
  eventName: string;
  ownerId: string;
  slug: string;
  version: number;
  pinHash: string;
};

function asInt(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function cookieSecret() {
  return String(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "").trim();
}

function parseState(doc: CaptureDoc | null | undefined): CaptureKioskState & { pinHash: string } {
  const slug = typeof doc?.externalKioskSlug === "string" ? doc.externalKioskSlug.trim() : "";
  const pinHash = typeof doc?.externalKioskPinHash === "string" ? doc.externalKioskPinHash : "";
  return {
    enabled: doc?.externalKioskEnabled === true,
    slug,
    pinSet: Boolean(pinHash),
    version: Math.max(0, asInt(doc?.externalKioskVersion, 0)),
    pinHash,
  };
}

export function captureKioskUrl(slug: string) {
  const origin = publicAppUrl().replace(/\/$/, "");
  return slug ? `${origin}/c/${encodeURIComponent(slug)}` : "";
}

export function publicCaptureKiosk(state: CaptureKioskState) {
  return {
    enabled: state.enabled,
    pinSet: state.pinSet,
    slug: state.slug || null,
    path: state.slug ? `/c/${state.slug}` : null,
    url: state.enabled && state.slug ? captureKioskUrl(state.slug) : null,
  };
}

export async function getEventCaptureKiosk(eventId: string) {
  const doc = await getDocument<CaptureDoc>("Event", eventId);
  return parseState(doc);
}

async function slugTaken(slug: string, exceptEventId?: string) {
  const result = await runMongoCommand<{ cursor?: { firstBatch?: CaptureDoc[] } }>({
    find: "Event",
    filter: { externalKioskSlug: slug },
    limit: 1,
    projection: { _id: 1 },
  });
  const existing = oidValue(result.cursor?.firstBatch?.[0]?._id);
  if (!existing) return false;
  return existing !== exceptEventId;
}

export async function createCaptureSlug(exceptEventId?: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slug = randomBytes(6).toString("base64url");
    if (!/^[A-Za-z0-9_-]{8,}$/.test(slug)) continue;
    if (!(await slugTaken(slug, exceptEventId))) return slug;
  }
  throw new Error("Could not create a unique capture link");
}

export function validateCapturePin(pin: string) {
  const next = String(pin || "").trim();
  if (!CAPTURE_PIN_PATTERN.test(next)) {
    return { error: "PIN must be 4 to 8 digits" };
  }
  return { pin: next };
}

export async function hashCapturePin(pin: string) {
  return bcrypt.hash(pin, 12);
}

export async function pinMatches(pin: string, pinHash: string) {
  if (!pinHash) return false;
  return bcrypt.compare(pin, pinHash);
}

export async function saveEventCaptureKiosk(
  eventId: string,
  fields: {
    enabled?: boolean;
    slug?: string;
    pinHash?: string;
    version?: number;
  },
) {
  const extras: Record<string, unknown> = {};
  if (typeof fields.enabled === "boolean") extras.externalKioskEnabled = fields.enabled;
  if (typeof fields.slug === "string") extras.externalKioskSlug = fields.slug;
  if (typeof fields.pinHash === "string") extras.externalKioskPinHash = fields.pinHash;
  if (typeof fields.version === "number") extras.externalKioskVersion = fields.version;
  if (Object.keys(extras).length > 0) {
    await setDocumentFields("Event", eventId, extras);
  }
  return getEventCaptureKiosk(eventId);
}

export async function findLiveCaptureKiosk(slug: string): Promise<LiveCaptureKiosk | null> {
  const nextSlug = String(slug || "").trim();
  if (!nextSlug) return null;
  const result = await runMongoCommand<{ cursor?: { firstBatch?: CaptureDoc[] } }>({
    find: "Event",
    filter: { externalKioskSlug: nextSlug, externalKioskEnabled: true },
    limit: 1,
  });
  const doc = result.cursor?.firstBatch?.[0];
  const eventId = oidValue(doc?._id);
  if (!eventId || doc?.status === "archived") return null;
  const state = parseState(doc);
  if (!state.enabled || !state.slug || !state.pinHash) return null;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, status: true, userId: true },
  });
  if (!event || event.status === "archived") return null;
  const ownerId = oidValue(doc?.userId) || event.userId || "";
  if (!ownerId) return null;
  return {
    eventId: event.id,
    eventName: event.name,
    ownerId,
    slug: state.slug,
    version: state.version,
    pinHash: state.pinHash,
  };
}

export function captureCookieName(slug: string) {
  return `${CAPTURE_COOKIE}_${slug}`;
}

function signUnlock(slug: string, version: number, exp: number) {
  const secret = cookieSecret();
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  const payload = `${slug}.${version}.${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyCaptureUnlock(token: string | undefined, slug: string, version: number) {
  if (!token) return false;
  const secret = cookieSecret();
  if (!secret) return false;
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const [cookieSlug, cookieVersion, exp, sig] = parts;
  if (cookieSlug !== slug || Number(cookieVersion) !== version) return false;
  if (!Number.isFinite(Number(exp)) || Number(exp) < Date.now()) return false;
  const payload = `${cookieSlug}.${cookieVersion}.${exp}`;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function setCaptureUnlockCookie(slug: string, version: number) {
  const exp = Date.now() + COOKIE_TTL_SECONDS * 1000;
  const store = await cookies();
  store.set(captureCookieName(slug), signUnlock(slug, version, exp), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_TTL_SECONDS,
  });
}

export async function hasCaptureUnlock(slug: string, version: number) {
  const store = await cookies();
  return verifyCaptureUnlock(store.get(captureCookieName(slug))?.value, slug, version);
}
