import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { getEntry } from "@/lib/journal";
import { listObservations } from "@/lib/observations";
import { formatWhen } from "@/lib/media";
import { ObservationCard } from "@/components/observation-card";
import { JournalBody } from "@/components/journal-body";
import { DeleteEntryButton } from "./delete-button";

export default async function EntryPage({ params }: PageProps<"/journal/[id]">) {
  const { id } = await params;
  const [member, entry] = await Promise.all([getCurrentMember(), getEntry(id)]);
  if (!entry) notFound();
  const mine = entry.owner_id === member.id;
  const sightings = await listObservations({ ids: entry.observationIds }, 100);

  return (
    <article className="mx-auto max-w-3xl">
      <Link href={mine ? "/journal" : "/journal?show=team"} className="text-sm text-forest-700 hover:underline">
        ← Journal
      </Link>

      <header className="mt-4">
        <h1 className="text-3xl font-semibold leading-tight">{entry.title || "Untitled entry"}</h1>
        <p className="mt-2 text-sm text-muted">
          {formatWhen(`${entry.entry_date}T12:00:00+05:30`, false)}
          {entry.place_name ? ` · ${entry.place_name}` : ""}
          {entry.weather ? ` · ${entry.weather}` : ""}
          {!mine && ` · by ${entry.owner?.name ?? "a teammate"}`}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
              entry.is_shared ? "border-forest-600 bg-forest-50 text-forest-800" : "border-line bg-paper text-muted"
            }`}
          >
            {entry.is_shared ? "Shared with the team" : "Private"}
          </span>
          {entry.tags.map((t) => (
            <Link
              key={t}
              href={`/journal?${mine ? "" : "show=team&"}tag=${encodeURIComponent(t)}`}
              className="rounded-full bg-wash px-2.5 py-0.5 text-xs text-muted hover:text-ink"
            >
              #{t}
            </Link>
          ))}
        </div>
      </header>

      <div className="mt-8 rounded-xl border border-line bg-paper px-6 py-6">
        <JournalBody doc={entry.body} />
      </div>

      {sightings.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">Sightings linked to this entry</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {sightings.map((obs) => (
              <ObservationCard key={obs.id} obs={obs} me={member.id} />
            ))}
          </div>
        </section>
      )}

      {mine && (
        <div className="mt-10 flex items-center gap-4 border-t border-line pt-6 text-sm">
          <Link href={`/journal/${entry.id}/edit`} className="font-medium text-forest-700 hover:underline">
            Edit entry
          </Link>
          <div className="ml-auto">
            <DeleteEntryButton id={entry.id} />
          </div>
        </div>
      )}
    </article>
  );
}
