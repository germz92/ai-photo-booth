import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function localPath(key: string) {
  return path.join(process.cwd(), "data", key);
}

function s3() {
  return new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    },
  });
}

function isS3() {
  return process.env.STORAGE_DRIVER === "s3";
}

function s3Key(key: string) {
  const prefix = (process.env.S3_PREFIX || "").replace(/^\/+|\/+$/g, "");
  return prefix ? `${prefix}/${key}` : key;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  if (isS3()) {
    await s3().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: s3Key(key),
        Body: body,
        ContentType: contentType,
      }),
    );
    return;
  }

  const full = localPath(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, body);
}

export async function getObject(key: string): Promise<Buffer> {
  if (isS3()) {
    const result = await s3().send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: s3Key(key),
      }),
    );
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Empty object ${key}`);
    return Buffer.from(bytes);
  }

  return readFile(localPath(key));
}

export async function objectExists(key: string): Promise<boolean> {
  if (isS3()) {
    try {
      await s3().send(
        new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: s3Key(key) }),
      );
      return true;
    } catch {
      return false;
    }
  }
  try {
    await access(localPath(key));
    return true;
  } catch {
    return false;
  }
}

export function contentTypeForKey(key: string) {
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  if (key.endsWith(".webp")) return "image/webp";
  return "image/png";
}

export async function objectUrl(key: string): Promise<string | null> {
  if (!isS3()) return null;
  if (process.env.S3_PUBLIC_BASE_URL) {
    return `${process.env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${s3Key(key)}`;
  }
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: s3Key(key) }),
    { expiresIn: 60 * 60 },
  );
}
