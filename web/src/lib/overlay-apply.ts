import sharp from "sharp";
import { clampOverlayAxis, clampOverlayScale, overlayPosition, overlayShadowParams } from "./overlay";

export type OverlayStamp = {
  buffer: Buffer;
  x: number;
  y: number;
  scale: number;
  dropShadow?: boolean;
  shadow?: number;
};

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
  const logo = await sharp(logoBuffer, { failOn: "none" })
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
  if (!options.dropShadow) return { input: logo, left, top };
  const shadowed = await withPngDropShadow(logo, options.shadow ?? 0.45);
  return { input: shadowed.buffer, left: left - shadowed.pad, top: top - shadowed.pad };
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
      },
    ],
    options.contentType,
  );
}
