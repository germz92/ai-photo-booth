import { getDocument, setDocumentFields } from "./prisma";
import { parseThemeLooks, themeLooksPayload, type ThemeLooks } from "./theme-looks";

export async function loadThemeLooks(id: string, fallbackPrompt = "") {
  const doc = await getDocument<Record<string, unknown>>("Theme", id);
  return parseThemeLooks(doc, fallbackPrompt);
}

export async function saveThemeLooks(id: string, looks: ThemeLooks) {
  await setDocumentFields("Theme", id, themeLooksPayload(looks));
}

export async function attachThemeLooks<T extends { id: string; prompt?: string }>(themes: T[]) {
  return Promise.all(
    themes.map(async (theme) => {
      const looks = await loadThemeLooks(theme.id, theme.prompt || "");
      return { ...theme, ...looks };
    }),
  );
}
