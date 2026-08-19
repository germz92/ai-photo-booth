import sharp from "sharp";
import { getObject, objectExists, putObject } from "./storage";

const THUMB_MAX = 960;
const THUMB_QUALITY = 72;

export function outputThumbKey(jobId: string, index: number) {
  return `thumbs/${jobId}-${index}.jpg`;
}

export function originalThumbKey(jobId: string) {
  return `thumbs/${jobId}-original.jpg`;
}

export async function makeThumb(buffer: Buffer) {
  return sharp(buffer)
    .rotate()
    .resize(THUMB_MAX, THUMB_MAX, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: THUMB_QUALITY, mozjpeg: true })
    .toBuffer();
}

export async function saveThumb(thumbKey: string, buffer: Buffer) {
  const thumb = await makeThumb(buffer);
  await putObject(thumbKey, thumb, "image/jpeg");
  return thumb;
}

export async function readThumb(sourceKey: string, thumbKey: string) {
  if (await objectExists(thumbKey)) return getObject(thumbKey);
  const source = await getObject(sourceKey);
  try {
    return await saveThumb(thumbKey, source);
  } catch (error) {
    console.error("Thumb create failed", error);
    return source;
  }
}
