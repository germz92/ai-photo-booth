import sharp from "sharp";
import { clampOverlayAxis, clampOverlayScale, overlayPosition } from "./overlay";

export async function applyLogoOverlay(
  imageBuffer: Buffer,
  logoBuffer: Buffer,
  options: {
    x: number;
    y: number;
    scale: number;
    contentType?: string;
  },
) {
  const image = sharp(imageBuffer, { failOn: "none" }).rotate();
  const meta = await image.metadata();
  const width = meta.width || 832;
  const height = meta.height || 1216;
  const scale = clampOverlayScale(options.scale);
  const logoWidth = Math.max(8, Math.round(width * scale));
  const logo = await sharp(logoBuffer, { failOn: "none" })
    .rotate()
    .resize({ width: logoWidth, withoutEnlargement: false })
    .png()
    .toBuffer();
  const logoMeta = await sharp(logo).metadata();
  const logoHeight = logoMeta.height || Math.round(logoWidth / 2);
  const { left, top } = overlayPosition(
    width,
    height,
    logoWidth,
    logoHeight,
    clampOverlayAxis(options.x, 0.5),
    clampOverlayAxis(options.y, 0.045),
  );
  const composed = image.composite([{ input: logo, left, top }]);
  const type = (options.contentType || "").toLowerCase();
  if (type.includes("jpeg") || type.includes("jpg") || meta.format === "jpeg") {
    return composed.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  }
  if (type.includes("webp") || meta.format === "webp") {
    return composed.webp({ quality: 92 }).toBuffer();
  }
  return composed.png().toBuffer();
}
