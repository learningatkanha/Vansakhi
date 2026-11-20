"use client";

import exifr from "exifr";

/** Browser-side upload of one photo or video straight to R2. Used by the sighting form and the journal editor. */

export const MAX_BYTES = 100 * 1024 * 1024;
const MAX_SIDE = 2560;

export type Uploaded = { key: string; kind: "photo" | "video"; mime: string; size: number; takenAt?: string; lat?: number; lng?: number };

export function kindOf(file: File): "photo" | "video" | null {
  return file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "photo" : null;
}

/** Photo date and GPS from EXIF, when the camera recorded them. */
export async function readPhotoData(file: File): Promise<{ takenAt?: string; lat?: number; lng?: number }> {
  try {
    const data = await exifr.parse(file, { gps: true, pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude"] });
    const date: Date | undefined = data?.DateTimeOriginal ?? data?.CreateDate;
    const lat = typeof data?.latitude === "number" ? data.latitude : undefined;
    const lng = typeof data?.longitude === "number" ? data.longitude : undefined;
    return { takenAt: date instanceof Date && !isNaN(+date) ? date.toISOString() : undefined, lat, lng };
  } catch {
    return {};
  }
}

/** Shrinks big photos to at most 2560 px on the long side. Leaves files the browser can't read (e.g. HEIC on Chrome) as they are. */
export async function shrinkPhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 3 * 1024 * 1024 && file.type === "image/jpeg") return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

function putWithProgress(url: string, body: Blob, contentType: string, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload blocked. Check the storage CORS settings."));
    xhr.send(body);
  });
}

/** Resizes (photos), asks the server for a signed link, and uploads. Throws an Error with a readable message. */
export async function uploadFile(file: File, onProgress: (p: number) => void = () => {}): Promise<Uploaded> {
  const kind = kindOf(file);
  if (!kind) throw new Error("Only photos and videos can be added.");
  let body: Blob = file;
  let exif = {};
  if (kind === "photo") {
    exif = await readPhotoData(file);
    body = await shrinkPhoto(file);
  }
  const contentType = body.type || file.type;
  if (body.size > MAX_BYTES) throw new Error("Files must be under 100 MB.");

  const res = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType, size: body.size }),
  });
  const signed = await res.json();
  if (!res.ok) throw new Error(signed.error ?? "Could not start the upload.");

  await putWithProgress(signed.url, body, contentType, onProgress);
  return { key: signed.key, kind, mime: contentType, size: body.size, ...exif };
}
