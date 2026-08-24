/** Flux Krea / booth portrait size. FluxKontextImageScale then maps this to 832x1248. */
export const CAPTURE_WIDTH = 832;
export const CAPTURE_HEIGHT = 1216;
export const CAPTURE_ASPECT = CAPTURE_WIDTH / CAPTURE_HEIGHT;

export function coverCrop(srcW: number, srcH: number) {
  const srcAspect = srcW / Math.max(srcH, 1);
  if (srcAspect > CAPTURE_ASPECT) {
    const sw = srcH * CAPTURE_ASPECT;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
  }
  const sh = srcW / CAPTURE_ASPECT;
  return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
}

export function imageToJpegDataUrl(source: CanvasImageSource, width: number, height: number, mirror = false) {
  if (width < 2 || height < 2) return null;
  const { sx, sy, sw, sh } = coverCrop(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = CAPTURE_WIDTH;
  canvas.height = CAPTURE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (mirror) {
    ctx.translate(CAPTURE_WIDTH, 0);
    ctx.scale(-1, 1);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);
  return canvas.toDataURL("image/jpeg", 0.92);
}

export async function fileToBoothJpeg(file: File) {
  const bitmap = await createImageBitmap(file);
  const dataUrl = imageToJpegDataUrl(bitmap, bitmap.width, bitmap.height);
  bitmap.close();
  if (!dataUrl) throw new Error("Could not read that image.");
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], "guest.jpg", { type: "image/jpeg" });
}
