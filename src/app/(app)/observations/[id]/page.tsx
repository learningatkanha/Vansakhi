import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { getObservation } from "@/lib/observations";
import { formatWhen } from "@/lib/media";
import { monthOf, timeOfDayOf } from "@/lib/when";
import { StatusBadge } from "@/components/observation-card";
import { entriesForSighting, myRecentEntries } from "@/lib/journal";
import { linkEntry, unlinkEntry } from "../../journal/actions";
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

const dateLabel = (d: string) =>
  new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export default async function ObservationPage({ params, searchParams }: PageProps<"/observations/[id]">) {
  const { id } = await params;
  const { saved } = await searchParams;
  const [member, obs] = await Promise.all([getCurrentMember(), getObservation(id)]);
  if (!obs) notFound();
  const [entries, myEntries] = await Promise.all([entriesForSighting(obs.id), myRecentEntries(member.id)]);
  const linkable = myEntries.filter((e) => !entries.some((x) => x.id === e.id));
  const writeHref = `/journal/new?obs=${obs.id}`;

  const details = [
    ["Month", monthOf(obs.observed_at)],
    ["Time of day", timeOfDayOf(obs.observed_at)],
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
        {saved === "1" && mine && (
          <div className="rounded-xl border border-forest-600 bg-forest-50 p-4 text-sm">
            <p className="font-medium">Sighting saved.</p>
            <p className="mt-0.5 text-muted">Would you like to write about it in your journal?</p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <Link
                href={writeHref}
                className="inline-flex h-9 items-center rounded-full bg-forest-600 px-4 font-medium text-white hover:bg-forest-700"
              >
                Write a journal entry
              </Link>
              <Link href={`/observations/${obs.id}`} className="text-muted hover:underline">
                Not now
              </Link>
            </div>
            {linkable.length > 0 && <p className="mt-2 text-xs text-muted">Or add it to an entry you&apos;ve already written, below.</p>}
          </div>
        )}

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

        <section className="rounded-xl border border-line bg-paper p-4 text-sm">
          <h2 className="font-medium">Journal entries</h2>
          {entries.length === 0 && <p className="mt-1 text-muted">No journal entries about this sighting yet.</p>}
          {entries.length > 0 && (
            <ul className="mt-2 divide-y divide-line">
              {entries.map((e) => {
                const own = e.owner_id === member.id;
                return (
                  <li key={e.id} className="flex items-center gap-2 py-2">
                    <Link href={`/journal/${e.id}`} className="min-w-0 flex-1 hover:text-forest-700">
                      <span className="block truncate font-medium">{e.title || "Untitled entry"}</span>
                      <span className="block truncate text-xs text-muted">
                        {dateLabel(e.entry_date)} · {own ? "you" : (e.owner?.name ?? "a teammate")}
                        {own && !e.is_shared ? " · private" : ""}
                      </span>
                    </Link>
                    {own && (
                      <form action={unlinkEntry}>
                        <input type="hidden" name="entryId" value={e.id} />
                        <input type="hidden" name="observationId" value={obs.id} />
                        <button
                          type="submit"
                          title="Unlink this entry from the sighting"
                          aria-label={`Unlink ${e.title || "entry"}`}
                          className="rounded-full px-2 text-lg leading-none text-muted hover:text-ink"
                        >
                          ×
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3 space-y-3 border-t border-line pt-3">
            <Link href={writeHref} className="inline-block font-medium text-forest-700 hover:underline">
              + Write a journal entry
            </Link>
            {linkable.length > 0 && (
              <form action={linkEntry} className="flex items-center gap-2">
                <input type="hidden" name="observationId" value={obs.id} />
                <select
                  name="entryId"
                  required
                  defaultValue=""
                  aria-label="Choose one of your journal entries"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 text-sm"
                >
                  <option value="" disabled>
                    Add to one of your entries…
                  </option>
                  {linkable.map((e) => (
                    <option key={e.id} value={e.id}>
                      {dateLabel(e.entry_date)} — {e.title || "Untitled entry"}
                    </option>
                  ))}
                </select>
                <button type="submit" className="h-9 shrink-0 rounded-full border border-line px-4 font-medium hover:bg-wash">
                  Add
                </button>
              </form>
            )}
          </div>
        </section>

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
