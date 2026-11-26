import Link from "next/link";
import type { Observation } from "@/lib/observations";
import { STATUS_HINT, STATUS_LABEL, type IdStatus } from "@/lib/id-status";
import { formatWhen } from "@/lib/media";

export function StatusBadge({ status }: { status: IdStatus }) {
  const look = {
    verified: "border-forest-700 bg-forest-600 text-white",
    self_confirmed: "border-forest-600 bg-forest-50 text-forest-800",
    suggested: "border-line bg-paper text-ink",
    needs_id: "border-amber-500 bg-amber-50 text-amber-900",
  }[status];
  return (
    <span title={STATUS_HINT[status]} className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${look}`}>
      {status === "verified" ? "✓ " : ""}
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ObservationCard({ obs, me }: { obs: Observation; me: string }) {
  const cover = obs.media[0];
  return (
    <Link href={`/observations/${obs.id}`} className="group overflow-hidden rounded-xl border border-line bg-paper transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] bg-wash">
        {cover?.url && cover.media_type === "photo" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.url} alt={obs.title} loading="lazy" className="h-full w-full object-cover" />
        )}
        {cover?.url && cover.media_type === "video" && (
          <video src={`${cover.url}#t=0.5`} muted preload="metadata" className="h-full w-full object-cover" />
        )}
        {!cover && <div className="flex h-full items-center justify-center text-xs text-muted">No photo</div>}
        <div className="absolute left-2 top-2">
          <StatusBadge status={obs.id_status} />
        </div>
        {cover?.media_type === "video" && (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">▶ video</span>
        )}
      </div>
      <div className="p-3">
        <p className="truncate font-semibold group-hover:text-forest-700">{obs.title}</p>
        <p className="truncate text-xs text-muted">
          {formatWhen(obs.observed_at, false)}
          {obs.place_name ? ` · ${obs.place_name.split(",")[0]}` : ""}
        </p>
        <p className="text-xs text-muted">by {obs.observer_id === me ? "you" : (obs.observer?.name ?? "a teammate")}</p>
      </div>
    </Link>
  );
}
