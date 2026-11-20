import "server-only";
import { signedViewUrl } from "@/lib/r2";

export type MediaRef = { file_key: string; media_type: string };

/** Signed view links for a list of media, in the same order. Missing storage keys give null. */
export async function viewUrls(items: MediaRef[]) {
  return Promise.all(
    items.map(async (m) => {
      try {
        return { ...m, url: await signedViewUrl(m.file_key) };
      } catch {
        return { ...m, url: null };
      }
    }),
  );
}

/** "14 Nov 2026 · 7:42 am", in India time. */
export function formatWhen(iso: string, withTime = true) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  if (!withTime) return date;
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
  return `${date} · ${time}`;
}
