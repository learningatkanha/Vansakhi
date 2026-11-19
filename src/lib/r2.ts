import "server-only";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** Cloudflare R2 speaks the S3 protocol, so the AWS SDK works with an R2 endpoint. */

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

const ALLOWED: Record<string, "photo" | "video" | "audio"> = {
  "image/jpeg": "photo",
  "image/png": "photo",
  "image/webp": "photo",
  "image/heic": "photo",
  "video/mp4": "video",
  "video/quicktime": "video",
  "video/webm": "video",
  "audio/mpeg": "audio",
  "audio/mp4": "audio",
  "audio/webm": "audio",
  "audio/wav": "audio",
};

export function mediaTypeFor(contentType: string) {
  return ALLOWED[contentType.toLowerCase()] ?? null;
}

function client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

/** A short-lived link the browser uses to upload one file straight to R2. */
export async function signedUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key, ContentType: contentType });
  return getSignedUrl(client(), command, { expiresIn: 600 });
}

/** A short-lived link to view one file. */
export async function signedViewUrl(key: string) {
  const command = new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key });
  return getSignedUrl(client(), command, { expiresIn: 3600 });
}
