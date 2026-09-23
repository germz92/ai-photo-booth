import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const outDir = path.join(process.cwd(), "public", "icons");

function markSvg(size: number, pad = 0) {
  const inset = pad;
  const box = size - inset * 2;
  const frameW = Math.round(box * 0.42);
  const frameH = Math.round(box * 0.62);
  const x = Math.round((size - frameW) / 2);
  const y = Math.round((size - frameH) / 2);
  const radius = Math.round(frameW * 0.16);
  const stroke = Math.max(8, Math.round(size * 0.038));
  const headR = Math.round(frameW * 0.16);
  const headCy = y + Math.round(frameH * 0.36);
  const bodyY = headCy + headR + Math.round(stroke * 0.4);
  const bodyW = Math.round(frameW * 0.46);
  const bodyH = Math.round(frameH * 0.22);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0a0a0a"/>
  <rect x="${x}" y="${y}" width="${frameW}" height="${frameH}" rx="${radius}" fill="none" stroke="#00e5ff" stroke-width="${stroke}"/>
  <circle cx="${size / 2}" cy="${headCy}" r="${headR}" fill="#00e5ff"/>
  <rect x="${(size - bodyW) / 2}" y="${bodyY}" width="${bodyW}" height="${bodyH}" rx="${Math.round(bodyH / 2)}" fill="#00e5ff"/>
</svg>`;
}

async function writePng(name: string, size: number, pad = 0) {
  const buffer = await sharp(Buffer.from(markSvg(size, pad))).png().toBuffer();
  await sharp(buffer).png().toFile(path.join(outDir, name));
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  await writePng("icon-192.png", 192);
  await writePng("icon-512.png", 512);
  await writePng("icon-512-maskable.png", 512, 72);
  await writePng("apple-touch-icon.png", 180);
}

void main();
