"use client";

import { useRef, useState } from "react";
import exifr from "exifr";

export type UploadItem = {
  id: string;
  name: string;
  kind: "photo" | "video";
  previewUrl: string;
  status: "uploading" | "done" | "error";
  progress: number;
  key?: string;
  mime: string;
  size: number;
  takenAt?: string; // ISO
  lat?: number;
  lng?: number;
  error?: string;
};

const MAX_BYTES = 100 * 1024 * 1024;
const MAX_SIDE = 2560;

/** Photo date and GPS from EXIF, when the camera recorded them. */
async function readPhotoData(file: File) {
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
async function shrinkPhoto(file: File): Promise<Blob> {
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

export function MediaUploader({ onChange }: { onChange: (items: UploadItem[]) => void }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const latest = useRef<UploadItem[]>([]);

  function update(id: string, patch: Partial<UploadItem>) {
    latest.current = latest.current.map((it) => (it.id === id ? { ...it, ...patch } : it));
    setItems(latest.current);
    onChange(latest.current);
  }

  function remove(id: string) {
    latest.current = latest.current.filter((it) => it.id !== id);
    setItems(latest.current);
    onChange(latest.current);
  }

  async function addFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "photo" : null;
      if (!kind) continue;
      const id = crypto.randomUUID();
      const item: UploadItem = {
        id, name: file.name, kind, previewUrl: URL.createObjectURL(file),
        status: "uploading", progress: 0, mime: file.type, size: file.size,
      };
      latest.current = [...latest.current, item];
      setItems(latest.current);
      onChange(latest.current);
      void upload(id, file, kind);
    }
  }

  async function upload(id: string, file: File, kind: "photo" | "video") {
    try {
      let body: Blob = file;
      if (kind === "photo") {
        update(id, await readPhotoData(file));
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

      await putWithProgress(signed.url, body, contentType, (progress) => update(id, { progress }));
      update(id, { status: "done", progress: 100, key: signed.key, mime: contentType, size: body.size });
    } catch (e) {
      update(id, { status: "error", error: e instanceof Error ? e.message : "Upload failed." });
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm transition-colors ${
          dragging ? "border-forest-600 bg-forest-50" : "border-line hover:border-forest-600"
        }`}
      >
        <p className="font-medium">Drop photos or videos here, or click to choose</p>
        <p className="mt-1 text-xs text-muted">Photos are resized automatically · videos up to 100 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm"
          multiple
          hidden
          onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {items.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {items.map((it) => (
            <li key={it.id} className="relative overflow-hidden rounded-lg border border-line bg-wash">
              {it.kind === "photo" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.previewUrl} alt={it.name} className="aspect-square w-full object-cover" />
              ) : (
                <video src={it.previewUrl} muted className="aspect-square w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => remove(it.id)}
                aria-label={`Remove ${it.name}`}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white"
              >
                ✕
              </button>
              <div className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-[11px] text-white">
                {it.status === "uploading" && `Uploading ${it.progress}%`}
                {it.status === "done" && (it.kind === "video" ? "▶ Video ready" : "Ready")}
                {it.status === "error" && <span className="text-red-200">{it.error}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
