import { z } from "zod";

export function normalizePhone(value?: string | null) {
  if (!value) return "";
  return value.replace(/[^\d+]/g, "");
}

export function normalizeGuestName(value?: string | null) {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function parseJobContact(
  email?: string | null,
  phone?: string | null,
  options?: { required?: boolean; name?: string | null },
) {
  const nextEmail = (email || "").trim();
  const nextPhone = normalizePhone(phone);
  const nextName = normalizeGuestName(options?.name);
  if (!nextEmail && !nextPhone) {
    if (options?.required === false) return { name: nextName || null, email: null, phone: null };
    return { error: "Provide an email or a mobile number" as const };
  }
  if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
    return { error: "Enter a valid email" as const };
  }
  return { name: nextName || null, email: nextEmail || null, phone: nextPhone || null };
}

export const createJobSchema = z
  .object({
    name: z.string().trim().max(80).optional(),
    email: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    eventId: z.string().trim().min(1, "Event is required"),
    themeId: z.string().trim().min(1, "Theme is required"),
    look: z.enum(["masculine", "feminine"]).optional(),
    skipContact: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const parsed = parseJobContact(value.email, value.phone, { required: !value.skipContact });
    if ("error" in parsed) {
      ctx.addIssue({
        code: "custom",
        message: parsed.error,
        path: ["email"],
      });
    }
  });
