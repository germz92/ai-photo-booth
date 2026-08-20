import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import bcrypt from "bcryptjs";
import { APP_EMAIL_FROM, APP_NAME } from "./brand";
import { appUrl } from "./runpod";
import { findAdminUserDoc, getDocument, mongoDate, oidValue, prisma, setDocumentFields } from "./prisma";
import type { CreditReason, PublicUser, UserRole, UserStatus } from "./user-types";

export type { CreditReason, LedgerEntry, PublicUser, UserRole, UserStatus } from "./user-types";

export class CreditError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 400, code = "CREDIT_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_PASSWORD = 8;

export function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createInviteToken() {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

export function defaultSuperadminCredits() {
  return Math.max(0, parseInt(process.env.SUPERADMIN_CREDITS || "10000", 10) || 10000);
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value && typeof value === "object" && "$date" in value) {
    return asDate((value as { $date: unknown }).$date);
  }
  return null;
}

function asIso(value: unknown) {
  return asDate(value)?.toISOString() ?? null;
}

function asInt(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

type UserDoc = {
  _id?: unknown;
  email?: unknown;
  name?: unknown;
  role?: unknown;
  status?: unknown;
  credits?: unknown;
  passwordHash?: unknown;
  inviteTokenHash?: unknown;
  inviteExpiresAt?: unknown;
  resetTokenHash?: unknown;
  resetExpiresAt?: unknown;
  createdAt?: unknown;
  lastLoginAt?: unknown;
};

function parseRole(value: unknown): UserRole {
  return value === "superadmin" ? "superadmin" : "user";
}

function parseStatus(value: unknown): UserStatus {
  if (value === "invited" || value === "disabled") return value;
  return "active";
}

export function publicUser(doc: UserDoc | null): PublicUser | null {
  if (!doc) return null;
  const id = oidValue(doc._id);
  const email = normalizeEmail(String(doc.email || ""));
  if (!id || !email) return null;
  return {
    id,
    email,
    name: typeof doc.name === "string" ? doc.name.trim() : "",
    role: parseRole(doc.role),
    status: parseStatus(doc.status),
    credits: Math.max(0, asInt(doc.credits, 0)),
    createdAt: asIso(doc.createdAt),
    lastLoginAt: asIso(doc.lastLoginAt),
    inviteExpiresAt: asIso(doc.inviteExpiresAt),
  };
}

async function findUserDocs(filter: Record<string, unknown>, options?: { sort?: Record<string, number>; limit?: number }) {
  const result = (await prisma.$runCommandRaw({
    find: "AdminUser",
    filter,
    ...(options?.sort ? { sort: options.sort } : {}),
    ...(options?.limit ? { limit: options.limit } : {}),
  } as never)) as { cursor?: { firstBatch?: UserDoc[] } };
  return result.cursor?.firstBatch || [];
}

async function findUserDocById(id: string) {
  return getDocument<UserDoc>("AdminUser", id);
}

export async function loadUserAccount(id: string) {
  if (!id) return null;
  return publicUser(await findUserDocById(id));
}

export const getUserAccount = cache(loadUserAccount);

export async function listUsers() {
  const docs = await findUserDocs({}, { sort: { createdAt: -1 } });
  return docs.map(publicUser).filter((row): row is PublicUser => Boolean(row));
}

export async function countActiveSuperadmins() {
  const docs = await findUserDocs({
    role: "superadmin",
    status: { $ne: "disabled" },
  });
  return docs.length;
}

export async function promoteToSuperadmin(id: string, options?: { grantCreditsIfMissing?: boolean }) {
  const doc = await findUserDocById(id);
  if (!doc) return null;
  const hasCredits = typeof doc.credits === "number" && Number.isFinite(doc.credits);
  const credits = hasCredits
    ? Math.max(0, Math.trunc(doc.credits as number))
    : options?.grantCreditsIfMissing
      ? defaultSuperadminCredits()
      : 0;
  const name = typeof doc.name === "string" && doc.name.trim() ? doc.name : "Super Admin";
  const status = doc.status === "invited" ? "invited" : "active";
  if (doc.role === "superadmin" && status === parseStatus(doc.status) && hasCredits && typeof doc.name === "string") {
    return publicUser(doc);
  }
  await setDocumentFields("AdminUser", id, {
    role: "superadmin",
    status,
    name,
    credits,
  });
  return publicUser(await findUserDocById(id));
}

async function insertLedger(entry: {
  userId: string;
  delta: number;
  balanceAfter: number;
  reason: CreditReason;
  jobId?: string;
  note?: string;
  createdBy?: string;
}) {
  const document: Record<string, unknown> = {
    userId: { $oid: entry.userId },
    delta: entry.delta,
    balanceAfter: entry.balanceAfter,
    reason: entry.reason,
    note: entry.note || "",
    createdBy: entry.createdBy || "system",
    createdAt: mongoDate(new Date()),
  };
  if (entry.jobId) document.jobId = { $oid: entry.jobId };
  await prisma.$runCommandRaw({
    insert: "CreditLedger",
    documents: [document],
  } as never);
}

async function modifyCredits(userId: string, delta: number, queryExtra: Record<string, unknown> = {}) {
  const result = (await prisma.$runCommandRaw({
    findAndModify: "AdminUser",
    query: { _id: { $oid: userId }, ...queryExtra },
    update: { $inc: { credits: delta } },
    new: true,
  } as never)) as { value?: UserDoc };
  return result.value ?? null;
}

export async function spendCreditForGeneration(userId: string, jobId?: string, createdBy = "system") {
  const updated = await modifyCredits(userId, -1, { credits: { $gte: 1 } });
  if (!updated) {
    const existing = await findUserDocById(userId);
    const account = publicUser(existing);
    throw new CreditError(
      !account || account.status !== "active" ? "Account is not active" : "Insufficient credits",
      402,
      "INSUFFICIENT_CREDITS",
    );
  }
  const account = publicUser(updated);
  try {
    await insertLedger({
      userId,
      delta: -1,
      balanceAfter: account?.credits ?? 0,
      reason: "generation",
      jobId,
      createdBy,
    });
  } catch (error) {
    console.error("Credit ledger write failed", error);
  }
  return account;
}

export async function refundGenerationCredit(userId: string, createdBy = "system") {
  const updated = await modifyCredits(userId, 1);
  if (!updated) return null;
  const account = publicUser(updated);
  try {
    await insertLedger({
      userId,
      delta: 1,
      balanceAfter: account?.credits ?? 0,
      reason: "refund",
      note: "Refund: generation did not start",
      createdBy,
    });
  } catch (error) {
    console.error("Credit refund ledger write failed", error);
  }
  return account;
}

export async function withGenerationCredit<T>(userId: string, run: () => Promise<T>) {
  await spendCreditForGeneration(userId, undefined, userId);
  try {
    return await run();
  } catch (error) {
    await refundGenerationCredit(userId, userId);
    throw error;
  }
}

export async function adjustCredits(
  userId: string,
  delta: number,
  options?: { note?: string; createdBy?: string; reason?: CreditReason },
) {
  const amount = Number(delta);
  if (!Number.isFinite(amount) || amount === 0) {
    throw new CreditError("delta must be a non-zero number", 400);
  }
  const rounded = Math.trunc(amount);

  const updated =
    rounded < 0
      ? await modifyCredits(userId, rounded, { credits: { $gte: Math.abs(rounded) } })
      : await modifyCredits(userId, rounded);

  if (!updated) {
    const existing = await findUserDocById(userId);
    throw new CreditError(existing ? "Insufficient credits for adjustment" : "User not found", existing ? 400 : 404);
  }

  const account = publicUser(updated);
  await insertLedger({
    userId,
    delta: rounded,
    balanceAfter: account?.credits ?? 0,
    reason: options?.reason || "admin_adjust",
    note: options?.note || "",
    createdBy: options?.createdBy || "system",
  });
  return account;
}

function mockEmail() {
  return process.env.MOCK_DELIVERY === "true" || !process.env.SENDGRID_API_KEY;
}

async function sendAccountEmail(to: string, subject: string, html: string, text: string) {
  if (mockEmail()) {
    console.log(`[email mock] ${to} ${subject}`);
    return { sent: false as const, reason: "Delivery mocked or SendGrid not configured" };
  }
  const from = process.env.EMAIL_FROM || APP_EMAIL_FROM;
  try {
    const sgMail = await import("@sendgrid/mail");
    sgMail.default.setApiKey(process.env.SENDGRID_API_KEY as string);
    await sgMail.default.send({ to, from, subject, html, text });
    return { sent: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Account email failed", message);
    return { sent: false as const, error: message };
  }
}

export function inviteUrl(token: string) {
  return `${appUrl()}/invite/${encodeURIComponent(token)}`;
}

export function resetUrl(token: string) {
  return `${appUrl()}/reset/${encodeURIComponent(token)}`;
}

export async function sendInviteEmail(user: PublicUser, rawToken: string) {
  const url = inviteUrl(rawToken);
  const result = await sendAccountEmail(
    user.email,
    `You are invited to ${APP_NAME}`,
    `
      <p>Hi${user.name ? ` ${user.name}` : ""},</p>
      <p>You have been invited to manage events in ${APP_NAME}. Click the link below to set your password and activate your account:</p>
      <p><a href="${url}">${url}</a></p>
      <p>This link expires in 7 days.</p>
    `,
    `You have been invited to ${APP_NAME}. Set your password: ${url}`,
  );
  return { ...result, inviteUrl: url };
}

export async function sendPasswordResetEmail(user: PublicUser, rawToken: string) {
  const url = resetUrl(rawToken);
  const result = await sendAccountEmail(
    user.email,
    `Reset your ${APP_NAME} password`,
    `
      <p>Hi${user.name ? ` ${user.name}` : ""},</p>
      <p>A superadmin requested a password reset for your ${APP_NAME} account. Click the link below to choose a new password:</p>
      <p><a href="${url}">${url}</a></p>
      <p>This link expires in 24 hours. If you did not expect this, you can ignore the email and keep using your current password.</p>
    `,
    `Reset your ${APP_NAME} password: ${url}`,
  );
  return { ...result, resetUrl: url };
}

export async function inviteUser(input: {
  email: string;
  name?: string;
  credits?: number;
  createdBy: string;
}) {
  const email = normalizeEmail(input.email);
  const name = String(input.name || "").trim();
  const credits = Math.max(0, Math.trunc(Number(input.credits) || 0));
  if (!email) throw new CreditError("Email is required", 400);

  const existing = await findAdminUserDoc({ email });
  if (existing) throw new CreditError("A user with that email already exists", 400);

  const { token, tokenHash } = createInviteToken();
  const user = await prisma.adminUser.create({
    data: { email, passwordHash: "" },
  });
  await setDocumentFields("AdminUser", user.id, {
    name,
    role: "user",
    status: "invited",
    credits: 0,
    inviteTokenHash: tokenHash,
    inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
    resetTokenHash: "",
  });

  let account = publicUser(await findUserDocById(user.id));
  if (credits > 0 && account) {
    account = await adjustCredits(user.id, credits, {
      reason: "invite_grant",
      note: "Initial invite grant",
      createdBy: input.createdBy,
    });
  }
  if (!account) throw new CreditError("Could not create user", 500);
  const emailResult = await sendInviteEmail(account, token);
  return { user: account, email: emailResult, inviteUrl: emailResult.inviteUrl };
}

export async function resendInvite(userId: string) {
  const doc = await findUserDocById(userId);
  const account = publicUser(doc);
  if (!account) throw new CreditError("User not found", 404);
  if (account.status !== "invited") throw new CreditError("User is not in invited status", 400);
  const { token, tokenHash } = createInviteToken();
  await setDocumentFields("AdminUser", userId, {
    inviteTokenHash: tokenHash,
    inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });
  const refreshed = publicUser(await findUserDocById(userId));
  if (!refreshed) throw new CreditError("User not found", 404);
  const emailResult = await sendInviteEmail(refreshed, token);
  return { user: refreshed, email: emailResult, inviteUrl: emailResult.inviteUrl };
}

export async function requestPasswordReset(userId: string) {
  const account = publicUser(await findUserDocById(userId));
  if (!account) throw new CreditError("User not found", 404);
  if (account.status === "invited") {
    throw new CreditError("User has not activated yet. Resend the invite instead.", 400);
  }
  const { token, tokenHash } = createInviteToken();
  await setDocumentFields("AdminUser", userId, {
    resetTokenHash: tokenHash,
    resetExpiresAt: new Date(Date.now() + RESET_TTL_MS),
  });
  const emailResult = await sendPasswordResetEmail(account, token);
  return { user: account, email: emailResult, resetUrl: emailResult.resetUrl };
}

export async function updateUser(
  userId: string,
  patch: { name?: string; status?: string; role?: string },
  actorId: string,
) {
  const doc = await findUserDocById(userId);
  const account = publicUser(doc);
  if (!account) throw new CreditError("User not found", 404);

  const fields: Record<string, unknown> = {};
  if (patch.name !== undefined) fields.name = String(patch.name || "").trim();
  if (patch.status !== undefined) {
    if (!["active", "disabled", "invited"].includes(patch.status)) {
      throw new CreditError("Invalid status", 400);
    }
    if (userId === actorId && patch.status === "disabled") {
      throw new CreditError("Cannot disable your own account", 400);
    }
    if (account.status === "invited" && patch.status === "active") {
      throw new CreditError("Invited users must accept their invite first", 400);
    }
    fields.status = patch.status;
  }
  if (patch.role !== undefined) {
    if (patch.role !== "superadmin" && patch.role !== "user") {
      throw new CreditError("Invalid role", 400);
    }
    const nextStatus = typeof fields.status === "string" ? fields.status : account.status;
    if (nextStatus !== "active" && patch.role === "superadmin") {
      throw new CreditError("Only active users can be made superadmin", 400);
    }
    if (account.role === "superadmin" && patch.role === "user") {
      const superCount = await countActiveSuperadmins();
      if (superCount <= 1) throw new CreditError("Cannot demote the last superadmin", 400);
    }
    fields.role = patch.role;
  }

  if (Object.keys(fields).length) {
    await setDocumentFields("AdminUser", userId, fields);
  }
  return publicUser(await findUserDocById(userId));
}

export async function lookupInvite(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const docs = await findUserDocs({
    inviteTokenHash: tokenHash,
    status: "invited",
  });
  const now = Date.now();
  const match = docs.find((doc) => {
    const expires = asDate(doc.inviteExpiresAt);
    return Boolean(expires && expires.getTime() > now);
  });
  return publicUser(match ?? null);
}

export async function acceptInvite(rawToken: string, password: string, name?: string) {
  if (String(password).length < MIN_PASSWORD) {
    throw new CreditError(`Password must be at least ${MIN_PASSWORD} characters`, 400);
  }
  const account = await lookupInvite(rawToken);
  if (!account) throw new CreditError("Invalid or expired invite", 400);
  const nextName = String(name || "").trim() || account.name;
  await setDocumentFields("AdminUser", account.id, {
    passwordHash: await bcrypt.hash(password, 12),
    name: nextName,
    status: "active",
    inviteTokenHash: "",
    inviteExpiresAt: null,
    lastLoginAt: new Date(),
  });
  return publicUser(await findUserDocById(account.id));
}

export async function lookupReset(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const docs = await findUserDocs({ resetTokenHash: tokenHash });
  const now = Date.now();
  const match = docs.find((doc) => {
    const expires = asDate(doc.resetExpiresAt);
    return Boolean(expires && expires.getTime() > now);
  });
  const account = publicUser(match ?? null);
  if (!account || account.status === "invited") return null;
  return account;
}

export async function acceptPasswordReset(rawToken: string, password: string) {
  if (String(password).length < MIN_PASSWORD) {
    throw new CreditError(`Password must be at least ${MIN_PASSWORD} characters`, 400);
  }
  const account = await lookupReset(rawToken);
  if (!account) throw new CreditError("Invalid or expired reset link", 400);
  await setDocumentFields("AdminUser", account.id, {
    passwordHash: await bcrypt.hash(password, 12),
    resetTokenHash: "",
    resetExpiresAt: null,
  });
  return account;
}

export async function markLogin(userId: string) {
  await setDocumentFields("AdminUser", userId, { lastLoginAt: new Date() });
}

export async function listLedger(userId: string, limit = 50) {
  const result = (await prisma.$runCommandRaw({
    find: "CreditLedger",
    filter: { $or: [{ userId }, { userId: { $oid: userId } }] },
    sort: { createdAt: -1 },
    limit: Math.min(Math.max(limit, 1), 200),
  } as never)) as { cursor?: { firstBatch?: Array<Record<string, unknown>> } };
  return (result.cursor?.firstBatch || []).map((row) => ({
    id: oidValue(row._id),
    userId: oidValue(row.userId) || userId,
    delta: asInt(row.delta),
    balanceAfter: asInt(row.balanceAfter),
    reason: String(row.reason || ""),
    jobId: oidValue(row.jobId),
    note: typeof row.note === "string" ? row.note : "",
    createdBy: String(row.createdBy || "system"),
    createdAt: asIso(row.createdAt),
  }));
}

export async function verifyAccountPassword(userId: string, password: string) {
  const doc = await findUserDocById(userId);
  const passwordHash = typeof doc?.passwordHash === "string" ? doc.passwordHash : "";
  if (!userId || !password || !passwordHash) return false;
  return bcrypt.compare(password, passwordHash);
}

export function creditErrorResponse(error: unknown) {
  if (error instanceof CreditError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.statusCode });
  }
  const message = error instanceof Error ? error.message : "Request failed";
  return Response.json({ error: message }, { status: 500 });
}
