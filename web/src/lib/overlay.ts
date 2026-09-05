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
export const DEFAULT_OVERLAY_SHADOW = 0.45;
export const DEFAULT_OVERLAY_STROKE_WIDTH = 3;
export const DEFAULT_OVERLAY_STROKE_COLOR = "#ffffff";
export const DEFAULT_OVERLAY_STROKE_OPACITY = 1;
export const OVERLAY_PREVIEW_WIDTH = 240;

export function isOverlayPlacement(value: unknown): value is OverlayPlacement {
  return typeof value === "string" && (OVERLAY_PLACEMENTS as readonly string[]).includes(value);
}

export function clampOverlayScale(value: unknown, fallback = DEFAULT_OVERLAY_SCALE) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0.02, n));
}

export function clampOverlayShadow(value: unknown, fallback = DEFAULT_OVERLAY_SHADOW) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0.1, n));
}

export function overlayShadowParams(strength: number, logoWidth = 90) {
  const amount = clampOverlayShadow(strength);
  const unit = Math.max(0.85, logoWidth / 90);
  return {
    blur: (2.5 + amount * 4.5) * unit,
    dx: 0,
    dy: Math.round((2 + amount * 3.5) * unit),
    opacity: 0.55 + amount * 0.35,
  };
}

export function overlayDropShadowCss(strength: number) {
  const amount = clampOverlayShadow(strength);
  const y1 = Math.round(2 + amount * 4);
  const y2 = Math.round(5 + amount * 8);
  const b1 = (3 + amount * 4).toFixed(1);
  const b2 = (7 + amount * 10).toFixed(1);
  const a1 = (0.6 + amount * 0.3).toFixed(2);
  const a2 = (0.3 + amount * 0.25).toFixed(2);
  return `drop-shadow(0 ${y1}px ${b1}px rgba(0, 0, 0, ${a1})) drop-shadow(0 ${y2}px ${b2}px rgba(0, 0, 0, ${a2}))`;
}

function asFlag(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

export function clampOverlayStrokeWidth(value: unknown, fallback = DEFAULT_OVERLAY_STROKE_WIDTH) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(16, Math.max(1, Math.round(n)));
}

export function clampOverlayStrokeOpacity(value: unknown, fallback = DEFAULT_OVERLAY_STROKE_OPACITY) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0.05, n));
}

export function parseOverlayColor(value: unknown, fallback = DEFAULT_OVERLAY_STROKE_COLOR) {
  if (typeof value !== "string") return fallback;
  const hex = value.trim();
  const short = hex.match(/^#([0-9a-fA-F]{3})$/);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^#([0-9a-fA-F]{6})$/.test(hex)) return hex.toLowerCase();
  if (/^([0-9a-fA-F]{6})$/.test(hex)) return `#${hex.toLowerCase()}`;
  return fallback;
}

export function overlayColorRgb(value: unknown) {
  const hex = parseOverlayColor(value);
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

export function overlayStrokeRadius(widthPx: number, imageWidth = 832) {
  const width = clampOverlayStrokeWidth(widthPx);
  const scale = imageWidth > 0 ? imageWidth / OVERLAY_PREVIEW_WIDTH : 1;
  return Math.min(64, Math.max(1, Math.round(width * scale)));
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

export const MAX_OVERLAY_LAYERS = 3;

export type StoredOverlayLayer = {
  logoKey: string;
  scale: number;
  x: number;
  y: number;
  dropShadow: boolean;
  shadow: number;
  stroke: boolean;
  strokeWidth: number;
  strokeColor: string;
  strokeOpacity: number;
};

const LAYER_PLACEMENTS: OverlayPlacement[] = ["top-center", "bottom-center", "top-right"];

export function defaultOverlayLayer(index: number): StoredOverlayLayer {
  const coords = overlayCoordsForPlacement(LAYER_PLACEMENTS[index] || DEFAULT_OVERLAY_PLACEMENT);
  return {
    logoKey: "",
    scale: DEFAULT_OVERLAY_SCALE,
    x: coords.x,
    y: coords.y,
    dropShadow: false,
    shadow: DEFAULT_OVERLAY_SHADOW,
    stroke: false,
    strokeWidth: DEFAULT_OVERLAY_STROKE_WIDTH,
    strokeColor: DEFAULT_OVERLAY_STROKE_COLOR,
    strokeOpacity: DEFAULT_OVERLAY_STROKE_OPACITY,
  };
}

export function parseStoredOverlayLayer(raw: unknown, index: number): StoredOverlayLayer {
  const fallback = defaultOverlayLayer(index);
  if (!raw || typeof raw !== "object") return fallback;
  const row = raw as Record<string, unknown>;
  const coords = overlayCoordsFromStored({ x: row.x, y: row.y });
  return {
    logoKey: typeof row.logoKey === "string" ? row.logoKey.trim() : "",
    scale: clampOverlayScale(row.scale, fallback.scale),
    x: coords.x,
    y: coords.y,
    dropShadow: asFlag(row.dropShadow),
    shadow: clampOverlayShadow(row.shadow, fallback.shadow),
    stroke: asFlag(row.stroke),
    strokeWidth: clampOverlayStrokeWidth(row.strokeWidth, fallback.strokeWidth),
    strokeColor: parseOverlayColor(row.strokeColor, fallback.strokeColor),
    strokeOpacity: clampOverlayStrokeOpacity(row.strokeOpacity, fallback.strokeOpacity),
  };
}

export function parseStoredOverlayLayers(
  raw: unknown,
  legacy?: {
    logoKey?: string;
    scale?: unknown;
    x?: unknown;
    y?: unknown;
    placement?: unknown;
    padding?: unknown;
  },
): StoredOverlayLayer[] {
  const layers = Array.from({ length: MAX_OVERLAY_LAYERS }, (_, index) => defaultOverlayLayer(index));
  if (Array.isArray(raw) && raw.length > 0) {
    raw.slice(0, MAX_OVERLAY_LAYERS).forEach((item, index) => {
      layers[index] = parseStoredOverlayLayer(item, index);
    });
    return layers;
  }
  if (legacy) {
    const coords = overlayCoordsFromStored(legacy);
    layers[0] = {
      logoKey: typeof legacy.logoKey === "string" ? legacy.logoKey.trim() : "",
      scale: clampOverlayScale(legacy.scale, DEFAULT_OVERLAY_SCALE),
      x: coords.x,
      y: coords.y,
      dropShadow: false,
      shadow: DEFAULT_OVERLAY_SHADOW,
      stroke: false,
      strokeWidth: DEFAULT_OVERLAY_STROKE_WIDTH,
      strokeColor: DEFAULT_OVERLAY_STROKE_COLOR,
      strokeOpacity: DEFAULT_OVERLAY_STROKE_OPACITY,
    };
  }
  return layers;
}

export function overlayLayerSourceKey(layer: StoredOverlayLayer, index: number, wallLogoKey = "") {
  return layer.logoKey || (index === 0 ? wallLogoKey.trim() : "");
}

export function clampOverlayLayerIndex(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_OVERLAY_LAYERS - 1, Math.max(0, Math.round(n)));
}

export function overlayLayersPayload(layers: StoredOverlayLayer[]) {
  return layers.slice(0, MAX_OVERLAY_LAYERS).map((layer, index) => {
    const next = parseStoredOverlayLayer(layer, index);
    return {
      logoKey: next.logoKey,
      scale: next.scale,
      x: next.x,
      y: next.y,
      dropShadow: next.dropShadow,
      shadow: next.shadow,
      stroke: next.stroke,
      strokeWidth: next.strokeWidth,
      strokeColor: next.strokeColor,
      strokeOpacity: next.strokeOpacity,
    };
  });
}

export function brandingOverlayWrite(layers: StoredOverlayLayer[]) {
  const payload = overlayLayersPayload(layers);
  const first = payload[0] || defaultOverlayLayer(0);
  return {
    overlayLayers: payload,
    overlayLogoKey: first.logoKey,
    overlayScale: first.scale,
    overlayX: first.x,
    overlayY: first.y,
    overlayPlacement: matchingOverlayPlacement(first.x, first.y) || "custom",
  };
}

export function publicOverlayLayers(layers: StoredOverlayLayer[], wallLogoKey = "") {
  return layers.slice(0, MAX_OVERLAY_LAYERS).map((layer, index) => ({
    hasLogo: Boolean(layer.logoKey),
    usesWallLogo: index === 0 && !layer.logoKey && Boolean(wallLogoKey),
    scale: layer.scale,
    x: layer.x,
    y: layer.y,
    dropShadow: layer.dropShadow,
    shadow: layer.shadow,
    stroke: layer.stroke,
    strokeWidth: layer.strokeWidth,
    strokeColor: layer.strokeColor,
    strokeOpacity: layer.strokeOpacity,
  }));
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
