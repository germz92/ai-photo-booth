export const OVERLAY_PLACEMENTS = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;

export type OverlayPlacement = (typeof OVERLAY_PLACEMENTS)[number];

export const DEFAULT_OVERLAY_PLACEMENT: OverlayPlacement = "top-center";
export const DEFAULT_OVERLAY_SCALE = 0.18;
export const DEFAULT_OVERLAY_EDGE = 0.045;

export function isOverlayPlacement(value: unknown): value is OverlayPlacement {
  return typeof value === "string" && (OVERLAY_PLACEMENTS as readonly string[]).includes(value);
}

export function clampOverlayScale(value: unknown, fallback = DEFAULT_OVERLAY_SCALE) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0.02, n));
}

export function clampOverlayAxis(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

export function overlayCoordsForPlacement(
  placement: OverlayPlacement,
  edge = DEFAULT_OVERLAY_EDGE,
) {
  const inset = Math.min(0.2, Math.max(0, edge));
  const far = 1 - inset;
  const x = placement.endsWith("left") ? inset : placement.endsWith("right") ? far : 0.5;
  const y = placement.startsWith("bottom") ? far : inset;
  return { x, y };
}

export function overlayCoordsFromStored(options: {
  x?: unknown;
  y?: unknown;
  placement?: unknown;
  padding?: unknown;
}) {
  if (typeof options.x === "number" && Number.isFinite(options.x) && typeof options.y === "number" && Number.isFinite(options.y)) {
    return { x: clampOverlayAxis(options.x, 0.5), y: clampOverlayAxis(options.y, DEFAULT_OVERLAY_EDGE) };
  }
  const placement = isOverlayPlacement(options.placement)
    ? options.placement
    : DEFAULT_OVERLAY_PLACEMENT;
  const edge =
    typeof options.padding === "number" && Number.isFinite(options.padding)
      ? options.padding
      : DEFAULT_OVERLAY_EDGE;
  return overlayCoordsForPlacement(placement, edge);
}

export function matchingOverlayPlacement(x: number, y: number): OverlayPlacement | null {
  for (const placement of OVERLAY_PLACEMENTS) {
    const coords = overlayCoordsForPlacement(placement);
    if (Math.abs(coords.x - x) < 0.02 && Math.abs(coords.y - y) < 0.02) return placement;
  }
  return null;
}

export function overlayPosition(
  imageWidth: number,
  imageHeight: number,
  logoWidth: number,
  logoHeight: number,
  x: number,
  y: number,
) {
  const axisX = clampOverlayAxis(x, 0.5);
  const axisY = clampOverlayAxis(y, DEFAULT_OVERLAY_EDGE);
  const maxLeft = Math.max(0, imageWidth - logoWidth);
  const maxTop = Math.max(0, imageHeight - logoHeight);
  return {
    left: Math.round(axisX * maxLeft),
    top: Math.round(axisY * maxTop),
  };
}
