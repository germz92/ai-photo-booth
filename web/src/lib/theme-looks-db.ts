import { getDocument, setDocumentFields } from "./prisma";
import { parseThemeLooks, themeLooksPayload, type ThemeLooks } from "./theme-looks";
import { kreaRefinePromptFromQwen } from "./krea-refine-prompt";
import { defaultKreaPrompt } from "./workflow";

export async function loadThemeLooks(id: string, fallbackPrompt = "") {
  const doc = await getDocument<Record<string, unknown>>("Theme", id);
  return parseThemeLooks(doc, fallbackPrompt);
}

export async function saveThemeLooks(id: string, looks: ThemeLooks) {
  await setDocumentFields("Theme", id, themeLooksPayload(looks));
}

export type ThemeKreaPrompts = {
  kreaPrompt: string;
  masculineKreaPrompt: string;
  feminineKreaPrompt: string;
};

function asPrompt(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseThemeKrea(doc: Record<string, unknown> | null | undefined): ThemeKreaPrompts {
  return {
    kreaPrompt: asPrompt(doc?.kreaPrompt),
    masculineKreaPrompt: asPrompt(doc?.masculineKreaPrompt),
    feminineKreaPrompt: asPrompt(doc?.feminineKreaPrompt),
  };
}

export async function loadThemeKreaPrompts(id: string) {
  const doc = await getDocument<Record<string, unknown>>("Theme", id);
  return parseThemeKrea(doc);
}

function normalizePrompt(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function isSavedThemePrompt(qwenPrompt: string, themePrompt: string, looks: ThemeLooks) {
  const needle = normalizePrompt(qwenPrompt);
  if (!needle) return false;
  if (needle === normalizePrompt(themePrompt)) return true;
  if (!looks.splitLooks) return false;
  return (
    needle === normalizePrompt(looks.masculinePrompt) ||
    needle === normalizePrompt(looks.femininePrompt)
  );
}

export function kreaPromptForLook(looks: ThemeLooks, krea: ThemeKreaPrompts, look?: string | null) {
  if (looks.splitLooks) {
    if (look === "feminine") return krea.feminineKreaPrompt;
    if (look === "masculine") return krea.masculineKreaPrompt;
    return "";
  }
  return krea.kreaPrompt;
}

export function storedKreaPromptFor(
  qwenPrompt: string,
  themePrompt: string,
  looks: ThemeLooks,
  krea: ThemeKreaPrompts,
) {
  const needle = normalizePrompt(qwenPrompt);
  if (!needle) return "";
  if (looks.splitLooks) {
    if (needle === normalizePrompt(looks.masculinePrompt)) return krea.masculineKreaPrompt;
    if (needle === normalizePrompt(looks.femininePrompt)) return krea.feminineKreaPrompt;
  }
  if (needle === normalizePrompt(themePrompt)) return krea.kreaPrompt;
  return "";
}

export async function resolveJobKreaPrompt(options: {
  themeId: string;
  themePrompt: string;
  looks: ThemeLooks;
  qwenPrompt: string;
  look?: string | null;
  convertIfCustom?: boolean;
}) {
  const krea = await loadThemeKreaPrompts(options.themeId);
  const stored = storedKreaPromptFor(
    options.qwenPrompt,
    options.themePrompt,
    options.looks,
    krea,
  );
  if (stored) return stored;
  if (isSavedThemePrompt(options.qwenPrompt, options.themePrompt, options.looks)) {
    return kreaPromptForLook(options.looks, krea, options.look) || undefined;
  }
  if (options.convertIfCustom) {
    return kreaRefinePromptFromQwen(options.qwenPrompt, defaultKreaPrompt());
  }
  return undefined;
}

export async function lockThemeKreaPrompts(id: string, looks: ThemeLooks, prompt: string) {
  const stock = defaultKreaPrompt();
  if (looks.splitLooks) {
    const [masculineKreaPrompt, feminineKreaPrompt] = await Promise.all([
      kreaRefinePromptFromQwen(looks.masculinePrompt, stock),
      kreaRefinePromptFromQwen(looks.femininePrompt, stock),
    ]);
    await setDocumentFields("Theme", id, {
      kreaPrompt: masculineKreaPrompt,
      masculineKreaPrompt,
      feminineKreaPrompt,
    });
    return;
  }
  const kreaPrompt = await kreaRefinePromptFromQwen(prompt, stock);
  await setDocumentFields("Theme", id, {
    kreaPrompt,
    masculineKreaPrompt: "",
    feminineKreaPrompt: "",
  });
}

export async function attachThemeLooks<T extends { id: string; prompt?: string }>(themes: T[]) {
  return Promise.all(
    themes.map(async (theme) => {
      const looks = await loadThemeLooks(theme.id, theme.prompt || "");
      return { ...theme, ...looks };
    }),
  );
}
