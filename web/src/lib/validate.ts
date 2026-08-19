import { z } from "zod";

export function normalizePhone(value?: string | null) {
  if (!value) return "";
  return value.replace(/[^\d+]/g, "");
}

export function parseJobContact(
  email?: string | null,
  phone?: string | null,
  options?: { required?: boolean },
) {
  const nextEmail = (email || "").trim();
  const nextPhone = normalizePhone(phone);
  if (!nextEmail && !nextPhone) {
    if (options?.required === false) return { email: null, phone: null };
    return { error: "Provide an email or a mobile number" as const };
  }
  if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
    return { error: "Enter a valid email" as const };
  }
  return { email: nextEmail || null, phone: nextPhone || null };
}

export const createJobSchema = z
  .object({
    email: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    eventId: z.string().trim().min(1, "Event is required"),
    themeId: z.string().trim().min(1, "Theme is required"),
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
