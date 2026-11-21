import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { getObservation } from "@/lib/observations";
import { formatWhen } from "@/lib/media";
import { StatusBadge } from "@/components/observation-card";
import { Gallery } from "./gallery";
import { DeleteButton } from "./delete-button";

function MiniMap({ lat, lng }: { lat: number; lng: number }) {
  const d = 0.02;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`;
  return (
    <div>
      <iframe title="Map" src={src} className="h-44 w-full rounded-xl border border-line" loading="lazy" />
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-block text-xs text-forest-700 hover:underline"
      >
        Open in Google Maps ↗
      </a>
    </div>
  );
}

export default async function ObservationPage({ params }: PageProps<"/observations/[id]">) {
  const { id } = await params;
  const [member, obs] = await Promise.all([getCurrentMember(), getObservation(id)]);
  if (!obs) notFound();

  const details = [
    ["Life stage", obs.life_stage],
    ["Sex", obs.sex],
    ["Behaviour", obs.behaviour],
    ["Habitat", obs.habitat],
    ["Weather", obs.weather],
  ].filter(([, v]) => v);
  const mine = obs.observer_id === member.id;

  return (
    <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
      <div>
        <Gallery items={obs.media} title={obs.title} />
        {obs.notes && <p className="mt-4 whitespace-pre-line">{obs.notes}</p>}
      </div>

      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold">{obs.title}</h1>
          {obs.species && <p className="italic text-muted">{obs.species.scientific_name}</p>}
          {obs.species?.hindi_name && <p className="text-sm text-muted">{obs.species.hindi_name}</p>}
          <div className="mt-2">
            <StatusBadge status={obs.id_status} />
          </div>
        </div>

        <div className="space-y-1 text-sm">
          <p>{formatWhen(obs.observed_at)}</p>
          {obs.place_name && <p>{obs.place_name}</p>}
          {obs.count && obs.count > 1 && <p>{obs.count} seen</p>}
          <p className="text-muted">by {mine ? "you" : (obs.observer?.name ?? "a teammate")}</p>
        </div>

        {obs.lat !== null && obs.lng !== null && <MiniMap lat={obs.lat} lng={obs.lng} />}

        {details.length > 0 && (
          <details className="rounded-xl border border-line bg-paper p-4 text-sm">
            <summary className="cursor-pointer font-medium">More details</summary>
            <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-y-1">
              {details.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}

        <p className="rounded-xl bg-wash p-4 text-sm text-muted">
          Team identification (Agree / Suggest another) arrives in phase 5.
        </p>

        <div className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-forest-700 hover:underline">
            ← Back to sightings
          </Link>
          {(mine || member.role === "admin") && (
            <div className="ml-auto flex items-center gap-4">
              {mine && (
                <Link href={`/observations/${obs.id}/edit`} className="font-medium text-forest-700 hover:underline">
                  Edit
                </Link>
              )}
              <DeleteButton id={obs.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
