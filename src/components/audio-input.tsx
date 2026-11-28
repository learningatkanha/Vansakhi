"use client";

import { useEffect, useRef, useState } from "react";
import { uploadFile } from "@/lib/upload-client";

/** A recording attached to a creation: already saved (mediaId) or freshly uploaded (key). */
export type AudioValue = { mediaId?: string; key?: string; mime?: string; size?: number; url: string };

const MAX_SECONDS = 30 * 60;

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"]) if (MediaRecorder.isTypeSupported(t)) return t;
  return "";
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Record a story or poem in the browser (phone or computer), listen back, and keep it; or upload a recording.
 * Calls onBusy(true) while uploading so the form can wait.
 */
export function AudioInput({
  value,
  onChange,
  onBusy,
}: {
  value: AudioValue | null;
  onChange: (v: AudioValue | null) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [mode, setMode] = useState<"idle" | "recording" | "review" | "uploading">("idle");
  const [seconds, setSeconds] = useState(0);
  const [take, setTake] = useState<{ blob: Blob; url: string } | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || mime || "audio/webm" });
        setTake({ blob, url: URL.createObjectURL(blob) });
        setMode("review");
      };
      rec.start(1000);
      recorder.current = rec;
      setSeconds(0);
      setMode("recording");
      timer.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setError("The microphone couldn't be used. Allow microphone access for this site in your browser, or upload a recording instead.");
    }
  }

  function stop() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  async function keep(file: File) {
    setError(null);
    setMode("uploading");
    setProgress(0);
    onBusy(true);
    try {
      const up = await uploadFile(file, setProgress, { allowAudio: true });
      onChange({ key: up.key, mime: up.mime, size: up.size, url: URL.createObjectURL(file) });
      setTake(null);
      setMode("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload failed. Please try again.");
      setMode(take ? "review" : "idle");
    } finally {
      onBusy(false);
    }
  }

  function keepTake() {
    if (!take) return;
    const ext = take.blob.type.includes("mp4") ? "m4a" : "webm";
    void keep(new File([take.blob], `recording.${ext}`, { type: take.blob.type }));
  }

  const button = "inline-flex h-10 items-center rounded-full px-4 text-sm font-medium";

  if (value && mode === "idle") {
    return (
      <div className="space-y-2 rounded-lg border border-line bg-wash p-3">
        <audio controls src={value.url} className="w-full" />
        <button type="button" onClick={() => onChange(null)} className="text-sm text-muted hover:text-red-700 hover:underline">
          Remove and record again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-line bg-wash p-4">
      {mode === "idle" && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={start} className={`${button} bg-forest-600 text-white hover:bg-forest-700`}>
            ● Start recording
          </button>
          <label className={`${button} cursor-pointer border border-line bg-paper hover:bg-wash`}>
            Upload a recording
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void keep(f);
              }}
            />
          </label>
        </div>
      )}
      {mode === "recording" && (
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-2 font-medium text-red-700">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600 motion-reduce:animate-none" aria-hidden />
            Recording {clock(seconds)}
          </span>
          <button type="button" onClick={stop} className={`${button} border border-line bg-paper hover:bg-wash`}>
            ■ Stop
          </button>
        </div>
      )}
      {mode === "review" && take && (
        <div className="space-y-3">
          <audio controls src={take.url} className="w-full" />
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={keepTake} className={`${button} bg-forest-600 text-white hover:bg-forest-700`}>
              Keep this recording
            </button>
            <button
              type="button"
              onClick={() => {
                setTake(null);
                setMode("idle");
              }}
              className={`${button} border border-line bg-paper hover:bg-wash`}
            >
              Record again
            </button>
          </div>
        </div>
      )}
      {mode === "uploading" && <p className="text-sm text-muted">Saving the recording… {progress}%</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
      {mode === "idle" && <p className="text-xs text-muted">Up to 30 minutes. Find a quiet spot, and hold the phone a little away from your mouth.</p>}
    </div>
  );
}
