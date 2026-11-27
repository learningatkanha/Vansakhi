import Link from "next/link";
import type { Observation } from "@/lib/observations";
import { STATUS_HINT, STATUS_LABEL, type IdStatus } from "@/lib/id-status";
import { formatWhen } from "@/lib/media";

export function StatusBadge({ status }: { status: IdStatus }) {
  const look = {
    verified: "bg-forest-600 text-white",
    self_confirmed: "bg-forest-50 text-forest-800 ring-1 ring-inset ring-forest-100",
    suggested: "bg-paper text-ink ring-1 ring-inset ring-line",
    needs_id: "bg-meadow-50 text-meadow-800 ring-1 ring-inset ring-meadow-100",
  }[status];
  return (
    <span title={STATUS_HINT[status]} className={`specimen-tag ${look}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Photo-first sighting card: species in the book serif, scientific name in italic, then when, where and who. */
export function ObservationCard({ obs, me }: { obs: Observation; me: string }) {
  const cover = obs.media[0];
  const scientific = obs.species?.common_name ? obs.species.scientific_name : null;
  const place = obs.place_name?.split(",")[0];
  return (
    <Link
      href={`/observations/${obs.id}`}
      className="group flex flex-col overflow-hidden rounded-md border border-line bg-paper transition-colors hover:border-forest-600"
    >
      <div className="relative aspect-[4/5] bg-wash">
        {cover?.url && cover.media_type === "photo" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.url} alt={obs.title} loading="lazy" className="h-full w-full object-cover" />
        )}
        {cover?.url && cover.media_type === "video" && (
          <video src={`${cover.url}#t=0.5`} muted preload="metadata" className="h-full w-full object-cover" />
        )}
        {!cover && <div className="flex h-full items-center justify-center text-sm text-muted">No photo</div>}
        <div className="absolute left-2.5 top-2.5">
          <StatusBadge status={obs.id_status} />
        </div>
        {cover?.media_type === "video" && (
          <span className="absolute bottom-2.5 right-2.5 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">▶ Video</span>
        )}
      </div>
      <div className="flex-1 px-3 pb-3 pt-2.5">
        <p className="font-serif text-[1.15rem] font-semibold leading-snug group-hover:text-forest-700">{obs.title}</p>
        {scientific && <p className="font-serif text-sm italic text-muted">{scientific}</p>}
        <p className="mt-1.5 text-[13px] leading-snug text-muted">
          {formatWhen(obs.observed_at, false)}
          {place ? `, ${place}` : ""}
        </p>
        <p className="text-[13px] leading-snug text-muted">{obs.observer_id === me ? "You" : (obs.observer?.name ?? "A teammate")}</p>
      </div>
    </Link>
  );
}
