export const LOOK_OPTIONS = [
  { id: "masculine", label: "Masculine" },
  { id: "feminine", label: "Feminine" },
] as const;

export type LookId = (typeof LOOK_OPTIONS)[number]["id"];

export type ThemeLooks = {
  splitLooks: boolean;
  masculinePrompt: string;
  femininePrompt: string;
};

export function isLookId(value: unknown): value is LookId {
  return value === "masculine" || value === "feminine";
}

export function parseThemeLooks(doc: Record<string, unknown> | null | undefined, fallbackPrompt = ""): ThemeLooks {
  const splitLooks = doc?.splitLooks === true;
  const masculinePrompt = typeof doc?.masculinePrompt === "string" ? doc.masculinePrompt.trim() : "";
  const femininePrompt = typeof doc?.femininePrompt === "string" ? doc.femininePrompt.trim() : "";
  const fallback = fallbackPrompt.trim();
  return {
    splitLooks,
    masculinePrompt: masculinePrompt || (!splitLooks ? fallback : ""),
    femininePrompt: femininePrompt || (!splitLooks ? fallback : ""),
  };
}

export function resolveThemePrompt(looks: ThemeLooks, fallbackPrompt: string, look?: string | null) {
  const fallback = fallbackPrompt.trim();
  if (!looks.splitLooks) return fallback;
  if (look === "masculine") return looks.masculinePrompt || fallback;
  if (look === "feminine") return looks.femininePrompt || fallback;
  return "";
}

export function themeLooksPayload(looks: ThemeLooks) {
  return {
    splitLooks: looks.splitLooks,
    masculinePrompt: looks.splitLooks ? looks.masculinePrompt : "",
    femininePrompt: looks.splitLooks ? looks.femininePrompt : "",
  };
}

export function validateThemeLooksInput(body: {
  splitLooks?: boolean;
  prompt?: string;
  masculinePrompt?: string;
  femininePrompt?: string;
}): { error: string } | { looks: ThemeLooks; prompt: string } {
  const splitLooks = body.splitLooks === true;
  const prompt = String(body.prompt || "").trim();
  const masculinePrompt = String(body.masculinePrompt || "").trim();
  const femininePrompt = String(body.femininePrompt || "").trim();
  if (splitLooks) {
    if (!masculinePrompt) return { error: "Masculine prompt is required" };
    if (!femininePrompt) return { error: "Feminine prompt is required" };
    return {
      looks: { splitLooks: true, masculinePrompt, femininePrompt },
      prompt: masculinePrompt,
    };
  }
  if (!prompt) return { error: "Prompt is required" };
  return {
    looks: { splitLooks: false, masculinePrompt: "", femininePrompt: "" },
    prompt,
  };
}
