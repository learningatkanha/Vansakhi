"use client";

import { useRef, useState } from "react";
import { kindOf, readPhotoData, uploadFile } from "@/lib/upload-client";

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
  mediaId?: string; // set for photos already saved with the sighting (when editing)
};

export function MediaUploader({ onChange, initial = [] }: { onChange: (items: UploadItem[]) => void; initial?: UploadItem[] }) {
  const [items, setItems] = useState<UploadItem[]>(initial);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const latest = useRef<UploadItem[]>(initial);

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
      const kind = kindOf(file);
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
      // Read the photo's date and GPS first, so the form can fill them in while the upload runs.
      if (kind === "photo") update(id, await readPhotoData(file));
      const done = await uploadFile(file, (progress) => update(id, { progress }));
      update(id, { status: "done", progress: 100, key: done.key, mime: done.mime, size: done.size });
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
              {!it.previewUrl ? (
                <div className="aspect-square w-full" />
              ) : it.kind === "photo" ? (
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
