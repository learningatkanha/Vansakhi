import Link from "next/link";
import { getCurrentMember } from "@/lib/auth";
import { listEntries, myTags, toDaySighting, type EntrySummary } from "@/lib/journal";
import { getObservation, listObservations, STATUS_LABEL, type Observation } from "@/lib/observations";
import { Card, PageHeader } from "@/components/ui";
import { SightingPicker, type PickerSighting } from "./sighting-picker";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function monthLabel(date: string) {
  return new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
}

function dayParts(date: string) {
  const d = new Date(`${date}T12:00:00+05:30`);
  return {
    day: d.toLocaleDateString("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" }),
    weekday: d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }),
  };
}

function toPicker(o: Observation, me: string): PickerSighting {
  const d = toDaySighting(o, me);
  return { id: d.id, title: d.title, when: d.when, place: d.place, thumb: d.thumb, status: STATUS_LABEL[o.id_status] };
}

export default async function JournalPage({ searchParams }: PageProps<"/journal">) {
  const member = await getCurrentMember();
  const sp = await searchParams;
  const scope = one(sp.show) === "team" ? "team" : "mine";
  const q = one(sp.q).slice(0, 100);
  const tag = one(sp.tag).slice(0, 40);
  const month = one(sp.month);
  const obsId = one(sp.obs);
  const filtered = Boolean(q || tag || month);
  // The Journal starts empty: pick a sighting to see its entries, or press "Show all".
  const mode: "sighting" | "all" | "pick" = obsId ? "sighting" : one(sp.all) === "1" || filtered ? "all" : "pick";

  const [entries, tags, sightingList] = await Promise.all([
    mode === "pick" ? Promise.resolve([]) : listEntries({ scope, memberId: member.id, isAdmin: member.role === "admin", q, tag, month, observationId: mode === "sighting" ? obsId : undefined }),
    scope === "mine" && mode === "all" ? myTags(member.id) : Promise.resolve([]),
    listObservations(scope === "mine" ? { observerId: member.id } : {}, 100),
  ]);
  const sightings = sightingList.map((o) => toPicker(o, member.id));
  let selected = mode === "sighting" ? (sightings.find((s) => s.id === obsId) ?? null) : null;
  if (mode === "sighting" && !selected) {
    const o = await getObservation(obsId);
    selected = o ? toPicker(o, member.id) : null;
  }

  const groups: { month: string; entries: EntrySummary[] }[] = [];
  for (const e of entries) {
    const m = monthLabel(e.entry_date);
    if (groups.at(-1)?.month !== m) groups.push({ month: m, entries: [] });
    groups.at(-1)!.entries.push(e);
  }

  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(scope === "team" ? { show: "team" } : {}), all: "1", ...(q ? { q } : {}), ...(tag ? { tag } : {}), ...(month ? { month } : {}), ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    const s = p.toString();
    return s ? `/journal?${s}` : "/journal";
  };

  return (
    <>
      <PageHeader title="Journal">
        <Link
          href="/journal/new"
          className="inline-flex h-10 items-center rounded-full bg-forest-600 px-5 text-sm font-medium text-white hover:bg-forest-700"
        >
          + New entry
        </Link>
      </PageHeader>

      <nav className="-mt-2 mb-6 flex gap-6 border-b border-line text-sm" aria-label="Journal sections">
        <span className="border-b-2 border-forest-600 pb-2 font-medium">Entries</span>
        <span className="pb-2 text-muted" title="Arrives later in phase 3">
          Notes <span className="text-xs">(soon)</span>
        </span>
        <span className="pb-2 text-muted" title="Arrives later in phase 3">
          Media <span className="text-xs">(soon)</span>
        </span>
      </nav>

      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 basis-72">
          <SightingPicker sightings={sightings} selected={selected} team={scope === "team"} />
        </div>
        <Link
          href={scope === "team" ? "/journal?show=team&all=1" : "/journal?all=1"}
          className={`inline-flex h-11 shrink-0 items-center rounded-full border px-5 text-sm font-medium ${
            mode === "all" ? "border-forest-600 bg-forest-50 text-forest-800" : "border-line bg-paper hover:bg-wash"
          }`}
        >
          Show all entries
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-2 text-sm">
          {[
            { key: "mine", label: "My journal" },
            { key: "team", label: "Shared by the team" },
          ].map((s) => (
            <Link
              key={s.key}
              href={s.key === "team" ? "/journal?show=team" : "/journal"}
              className={`rounded-full border px-3 py-1 ${scope === s.key ? "border-forest-600 bg-forest-50" : "border-line bg-paper text-muted hover:text-ink"}`}
            >
              {s.label}
            </Link>
          ))}
        </div>

        {mode === "all" && (
        <form action="/journal" className="ml-auto flex flex-wrap items-center gap-2">
          <input type="hidden" name="all" value="1" />
          {scope === "team" && <input type="hidden" name="show" value="team" />}
          {tag && <input type="hidden" name="tag" value={tag} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search words…"
            aria-label="Search entries"
            className="h-9 w-48 rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-forest-600"
          />
          <input
            type="month"
            name="month"
            defaultValue={month}
            aria-label="Month"
            className="h-9 rounded-lg border border-line bg-paper px-2 text-sm text-muted outline-none focus:border-forest-600"
          />
          <button type="submit" className="h-9 rounded-full border border-line bg-paper px-4 text-sm hover:bg-wash">
            Search
          </button>
        </form>
        )}
      </div>

      {tags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2 text-xs">
          {tags.map((t) => (
            <Link
              key={t}
              href={href({ tag: tag === t ? "" : t })}
              className={`rounded-full px-2.5 py-1 ${tag === t ? "bg-forest-600 text-white" : "bg-paper text-muted hover:text-ink"}`}
            >
              #{t}
            </Link>
          ))}
        </div>
      )}

      {filtered && (
        <p className="mb-4 text-sm text-muted">
          {entries.length} {entries.length === 1 ? "entry" : "entries"} found
          {tag ? ` tagged #${tag}` : ""}
          {q ? ` containing “${q}”` : ""}
          {month ? ` in ${monthLabel(`${month}-15`)}` : ""}.{" "}
          <Link href={scope === "team" ? "/journal?show=team&all=1" : "/journal?all=1"} className="text-forest-700 hover:underline">
            Clear
          </Link>
        </p>
      )}

      {mode === "pick" ? (
        <Card className="py-16 text-center">
          <p className="font-medium">Choose a sighting to see its journal entries.</p>
          <p className="mt-2 text-sm text-muted">
            Click the box above to pick one by its photo, or press <span className="font-medium">Show all entries</span>.
          </p>
        </Card>
      ) : mode === "sighting" && entries.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="font-medium">No journal entries for this sighting yet.</p>
          {selected && (
            <Link href={`/journal/new?obs=${selected.id}`} className="mt-6 inline-block text-sm font-medium text-forest-700 hover:underline">
              Write one
            </Link>
          )}
        </Card>
      ) : entries.length === 0 ? (
        <Card className="py-16 text-center">
          {filtered ? (
            <p className="font-medium">No entries match.</p>
          ) : scope === "team" ? (
            <>
              <p className="font-medium">Nothing shared yet.</p>
              <p className="mt-2 text-sm text-muted">When a teammate shares a journal entry, it appears here.</p>
            </>
          ) : (
            <>
              <p className="font-medium">Your journal is empty.</p>
              <p className="mt-2 text-sm text-muted">Entries are private unless you choose to share them.</p>
              <Link href="/journal/new" className="mt-6 inline-block text-sm font-medium text-forest-700 hover:underline">
                Write the first entry
              </Link>
            </>
          )}
        </Card>
      ) : (
        <div className="space-y-10">
          {groups.map((g) => (
            <section key={g.month}>
              <h2 className="mb-3 font-serif text-xl font-medium text-ink">{g.month}</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-paper">
                {g.entries.map((e) => {
                  const { day, weekday } = dayParts(e.entry_date);
                  return (
                    <li key={e.id}>
                      <Link href={`/journal/${e.id}`} className="flex gap-5 px-5 py-4 hover:bg-wash">
                        <div className="w-10 shrink-0 text-center">
                          <p className="font-serif text-2xl font-semibold leading-none">{day}</p>
                          <p className="mt-1 text-xs text-muted">{weekday}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-serif text-lg font-semibold leading-snug">{e.title || "Untitled entry"}</p>
                          {e.preview && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{e.preview}</p>}
                          {e.sightings.length > 0 && (
                            <p className="mt-1 truncate text-xs text-forest-700">
                              Sighting{e.sightings.length > 1 ? "s" : ""}: {e.sightings.join(", ")}
                            </p>
                          )}
                          <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
                            {scope === "team" && <span>by {e.owner?.name ?? "a teammate"}</span>}
                            {e.place_name && <span>{e.place_name.split(",")[0]}</span>}
                            {e.tags.slice(0, 4).map((t) => (
                              <span key={t}>#{t}</span>
                            ))}
                            {scope === "mine" && e.is_shared && <span className="text-forest-700">Shared</span>}
                            {scope === "team" && !e.is_shared && <span className="text-amber-700">Private (admin view)</span>}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
