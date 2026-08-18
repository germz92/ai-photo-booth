import { z } from "zod";

export function normalizePhone(value?: string | null) {
  if (!value) return "";
  return value.replace(/[^\d+]/g, "");
}

export const createJobSchema = z
  .object({
    email: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    consent: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (!value.consent) {
      ctx.addIssue({
        code: "custom",
        message: "Consent is required",
        path: ["consent"],
      });
    }

    const email = value.email || "";
    const phone = normalizePhone(value.phone);
    if (!email && !phone) {
      ctx.addIssue({
        code: "custom",
        message: "Provide an email or a mobile number",
        path: ["email"],
      });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid email",
        path: ["email"],
      });
    }
  });
