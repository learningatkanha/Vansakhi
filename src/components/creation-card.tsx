import Link from "next/link";
import type { Creation } from "@/lib/creations";
import { kindInfo } from "@/lib/creation-kinds";
import { formatWhen } from "@/lib/media";

/** A creation in the Adda gallery: the artwork itself, the opening lines, or a listening card. */
export function CreationCard({ c, me }: { c: Creation; me: string }) {
  const photo = c.media.find((m) => m.media_type === "photo" && m.url);
  const isAudio = c.kind === "audio_story" || c.kind === "audio_poem" || (!photo && c.media.some((m) => m.media_type === "audio"));
  const opening =
    c.kind === "poem"
      ? (c.text_body ?? "").split("\n").slice(0, 6).join("\n")
      : (c.text_body ?? "").replace(/\s+/g, " ").slice(0, 220) + ((c.text_body?.length ?? 0) > 220 ? "…" : "");

  return (
    <Link href={`/adda/${c.id}`} className="group flex flex-col overflow-hidden rounded-md border border-line bg-paper transition-colors hover:border-forest-600">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.url!} alt={c.title} loading="lazy" className="aspect-[4/5] w-full object-cover" />
      ) : isAudio ? (
        <div className="flex aspect-[4/5] flex-col items-center justify-center gap-3 bg-forest-50 px-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-forest-600 text-xl text-white" aria-hidden>
            ▶
          </span>
          <span className="text-sm text-forest-800">Listen</span>
        </div>
      ) : (
        <div className="aspect-[4/5] overflow-hidden bg-paper px-5 py-6">
          <p className={`font-serif text-[15px] leading-relaxed text-ink/85 ${c.kind === "poem" ? "whitespace-pre-line" : ""}`}>{opening}</p>
        </div>
      )}
      <div className="flex-1 border-t border-line px-3 pb-3 pt-2.5">
        <p className="text-xs text-forest-700">{kindInfo(c.kind).short}</p>
        <p className="font-serif text-[1.15rem] font-semibold leading-snug group-hover:text-forest-700">{c.title}</p>
        <p className="mt-1 text-[13px] text-muted">
          {c.author_id === me ? "You" : (c.author?.name ?? "A teammate")}, {formatWhen(c.created_at, false)}
        </p>
        {c.moved.length > 0 && <p className="text-[13px] text-muted">Moved {c.moved.length}</p>}
      </div>
    </Link>
  );
}
