import sharp from "sharp";
import {
  clampOverlayAxis,
  clampOverlayScale,
  clampOverlayStrokeOpacity,
  overlayColorRgb,
  overlayPosition,
  overlayShadowParams,
  overlayStrokeRadius,
  parseOverlayColor,
} from "./overlay";

export type OverlayStamp = {
  buffer: Buffer;
  x: number;
  y: number;
  scale: number;
  dropShadow?: boolean;
  shadow?: number;
  stroke?: boolean;
  strokeWidth?: number;
  strokeColor?: string;
  strokeOpacity?: number;
};

function dilateAlpha(alpha: Buffer, width: number, height: number, radius: number) {
  const tmp = Buffer.alloc(width * height);
  const out = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let max = 0;
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      for (let nx = x0; nx <= x1; nx++) max = Math.max(max, alpha[row + nx]);
      tmp[row + x] = max;
    }
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let max = 0;
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(height - 1, y + radius);
      for (let ny = y0; ny <= y1; ny++) max = Math.max(max, tmp[ny * width + x]);
      out[y * width + x] = max;
    }
  }
  return out;
}

async function withPngStroke(
  logoPng: Buffer,
  widthPx: number,
  color: string,
  opacity: number,
  imageWidth: number,
) {
  const radius = overlayStrokeRadius(widthPx, imageWidth);
  const pad = radius + 2;
  const { r, g, b } = overlayColorRgb(color);
  const alphaScale = clampOverlayStrokeOpacity(opacity);

  const { data, info } = await sharp(logoPng, { failOn: "none" })
    .ensureAlpha()
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  if (channels < 4) return { buffer: logoPng, pad: 0 };

  const alpha = Buffer.alloc(info.width * info.height);
  for (let i = 0, p = 0; i < data.length; i += channels, p++) {
    alpha[p] = data[i + 3];
  }

  const expanded = dilateAlpha(alpha, info.width, info.height, radius);
  const stroke = Buffer.alloc(info.width * info.height * 4);
  for (let p = 0; p < expanded.length; p++) {
    const cover = expanded[p];
    if (cover === 0) continue;
    const i = p * 4;
    stroke[i] = r;
    stroke[i + 1] = g;
    stroke[i + 2] = b;
    stroke[i + 3] = Math.round(cover * alphaScale);
  }

  const raw = { width: info.width, height: info.height, channels: 4 as const };
  const original = await sharp(data, { raw: { width: info.width, height: info.height, channels } })
    .png()
    .toBuffer();
  const buffer = await sharp(stroke, { raw })
    .composite([{ input: original, left: 0, top: 0 }])
    .png()
    .toBuffer();

  return { buffer, pad };
}

async function withPngDropShadow(logoPng: Buffer, strength: number) {
  const meta = await sharp(logoPng, { failOn: "none" }).ensureAlpha().metadata();
  const logoWidth = meta.width || 90;
  const { blur, dx, dy, opacity } = overlayShadowParams(strength, logoWidth);
  const sigma = Math.max(0.5, blur);
  const pad = Math.ceil(sigma * 3 + Math.max(Math.abs(dx), Math.abs(dy)) + 4);

  const { data, info } = await sharp(logoPng, { failOn: "none" })
    .ensureAlpha()
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  if (channels < 4) return { buffer: logoPng, pad: 0 };

  const silhouette = Buffer.from(data);
  for (let i = 0; i < silhouette.length; i += channels) {
    silhouette[i] = 0;
    silhouette[i + 1] = 0;
    silhouette[i + 2] = 0;
    silhouette[i + 3] = Math.round(data[i + 3] * opacity);
  }

  const raw = { width: info.width, height: info.height, channels };
  const [shadow, original] = await Promise.all([
    sharp(silhouette, { raw }).blur(sigma).png().toBuffer(),
    sharp(data, { raw }).png().toBuffer(),
  ]);

  const buffer = await sharp({
    create: {
      width: info.width,
      height: info.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: shadow, left: dx, top: dy },
      { input: original, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();

  return { buffer, pad };
}

async function logoComposite(
  logoBuffer: Buffer,
  imageWidth: number,
  imageHeight: number,
  options: OverlayStamp,
) {
  const scale = clampOverlayScale(options.scale);
  let logo: Buffer = await sharp(logoBuffer, { failOn: "none" })
    .rotate()
    .ensureAlpha()
    .resize({ width: Math.max(8, Math.round(imageWidth * scale)), withoutEnlargement: false })
    .png()
    .toBuffer();
  const logoMeta = await sharp(logo).metadata();
  const logoWidth = logoMeta.width || Math.max(8, Math.round(imageWidth * scale));
  const logoHeight = logoMeta.height || Math.round(logoWidth / 2);
  const { left, top } = overlayPosition(
    imageWidth,
    imageHeight,
    logoWidth,
    logoHeight,
    clampOverlayAxis(options.x, 0.5),
    clampOverlayAxis(options.y, 0.045),
  );

  let pad = 0;
  if (options.stroke) {
    const stroked = await withPngStroke(
      logo,
      options.strokeWidth ?? 3,
      parseOverlayColor(options.strokeColor),
      options.strokeOpacity ?? 1,
      imageWidth,
    );
    logo = stroked.buffer;
    pad += stroked.pad;
  }
  if (options.dropShadow) {
    const shadowed = await withPngDropShadow(logo, options.shadow ?? 0.45);
    logo = shadowed.buffer;
    pad += shadowed.pad;
  }
  return { input: logo, left: left - pad, top: top - pad };
}

export async function applyLogoOverlays(
  imageBuffer: Buffer,
  logos: OverlayStamp[],
  contentType?: string,
) {
  if (!logos.length) return imageBuffer;
  const image = sharp(imageBuffer, { failOn: "none" }).rotate();
  const meta = await image.metadata();
  const width = meta.width || 832;
  const height = meta.height || 1216;
  const composites = await Promise.all(
    logos.map((logo) => logoComposite(logo.buffer, width, height, logo)),
  );
  const composed = image.composite(composites);
  const type = (contentType || "").toLowerCase();
  if (type.includes("jpeg") || type.includes("jpg") || meta.format === "jpeg") {
    return composed.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  }
  if (type.includes("webp") || meta.format === "webp") {
    return composed.webp({ quality: 92 }).toBuffer();
  }
  return composed.png().toBuffer();
}

export async function applyLogoOverlay(
  imageBuffer: Buffer,
  logoBuffer: Buffer,
  options: {
    x: number;
    y: number;
    scale: number;
    dropShadow?: boolean;
    shadow?: number;
    stroke?: boolean;
    strokeWidth?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    contentType?: string;
  },
) {
  return applyLogoOverlays(
    imageBuffer,
    [
      {
        buffer: logoBuffer,
        x: options.x,
        y: options.y,
        scale: options.scale,
        dropShadow: options.dropShadow,
        shadow: options.shadow,
        stroke: options.stroke,
        strokeWidth: options.strokeWidth,
        strokeColor: options.strokeColor,
        strokeOpacity: options.strokeOpacity,
      },
    ],
    options.contentType,
  );
}
