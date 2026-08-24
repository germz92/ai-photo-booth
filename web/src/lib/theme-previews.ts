export const PREVIEW_KINDS = ["main", "masculine", "feminine"] as const;

export type PreviewKind = (typeof PREVIEW_KINDS)[number];

export type ThemePreviewKeys = {
  previewKey: string;
  masculinePreviewKey: string;
  femininePreviewKey: string;
};

export type ThemePreviewFlags = {
  hasPreview: boolean;
  hasMasculinePreview: boolean;
  hasFemininePreview: boolean;
  previewVersion: string;
};

const FIELDS: Record<PreviewKind, keyof ThemePreviewKeys> = {
  main: "previewKey",
  masculine: "masculinePreviewKey",
  feminine: "femininePreviewKey",
};

function asKey(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function isPreviewKind(value: unknown): value is PreviewKind {
  return value === "main" || value === "masculine" || value === "feminine";
}

export function parseThemePreviews(doc: Record<string, unknown> | null | undefined): ThemePreviewKeys {
  return {
    previewKey: asKey(doc?.previewKey),
    masculinePreviewKey: asKey(doc?.masculinePreviewKey),
    femininePreviewKey: asKey(doc?.femininePreviewKey),
  };
}

export function previewKeyFor(previews: ThemePreviewKeys, kind: PreviewKind) {
  return previews[FIELDS[kind]];
}

export function previewFieldFor(kind: PreviewKind) {
  return FIELDS[kind];
}

export function themePreviewFlags(previews: ThemePreviewKeys): ThemePreviewFlags {
  const version = [previews.previewKey, previews.masculinePreviewKey, previews.femininePreviewKey]
    .filter(Boolean)
    .map((key) => key.split("/").pop() || key)
    .join("-");
  return {
    hasPreview: Boolean(previews.previewKey),
    hasMasculinePreview: Boolean(previews.masculinePreviewKey),
    hasFemininePreview: Boolean(previews.femininePreviewKey),
    previewVersion: version,
  };
}

export function themeHasAnyPreview(flags: ThemePreviewFlags) {
  return flags.hasPreview || flags.hasMasculinePreview || flags.hasFemininePreview;
}
