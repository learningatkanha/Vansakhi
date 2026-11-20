import Link from "next/link";
import { getCurrentMember } from "@/lib/auth";
import { listEntries, myTags, type EntrySummary } from "@/lib/journal";
import { Card, PageHeader } from "@/components/ui";

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

export default async function JournalPage({ searchParams }: PageProps<"/journal">) {
  const member = await getCurrentMember();
  const sp = await searchParams;
  const scope = one(sp.show) === "team" ? "team" : "mine";
  const q = one(sp.q).slice(0, 100);
  const tag = one(sp.tag).slice(0, 40);
  const month = one(sp.month);
  const [entries, tags] = await Promise.all([
    listEntries({ scope, memberId: member.id, q, tag, month }),
    scope === "mine" ? myTags(member.id) : Promise.resolve([]),
  ]);
  const filtered = Boolean(q || tag || month);

  const groups: { month: string; entries: EntrySummary[] }[] = [];
  for (const e of entries) {
    const m = monthLabel(e.entry_date);
    if (groups.at(-1)?.month !== m) groups.push({ month: m, entries: [] });
    groups.at(-1)!.entries.push(e);
  }

  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(scope === "team" ? { show: "team" } : {}), ...(q ? { q } : {}), ...(tag ? { tag } : {}), ...(month ? { month } : {}), ...patch });
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
          Notes <span className="text-[10px] uppercase tracking-wide">soon</span>
        </span>
        <span className="pb-2 text-muted" title="Arrives later in phase 3">
          Media <span className="text-[10px] uppercase tracking-wide">soon</span>
        </span>
      </nav>

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

        <form action="/journal" className="ml-auto flex flex-wrap items-center gap-2">
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
          <Link href={scope === "team" ? "/journal?show=team" : "/journal"} className="text-forest-700 hover:underline">
            Clear
          </Link>
        </p>
      )}

      {entries.length === 0 ? (
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
                Write the first entry →
              </Link>
            </>
          )}
        </Card>
      ) : (
        <div className="space-y-10">
          {groups.map((g) => (
            <section key={g.month}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{g.month}</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-paper">
                {g.entries.map((e) => {
                  const { day, weekday } = dayParts(e.entry_date);
                  return (
                    <li key={e.id}>
                      <Link href={`/journal/${e.id}`} className="flex gap-5 px-5 py-4 hover:bg-wash">
                        <div className="w-10 shrink-0 text-center">
                          <p className="text-xl font-semibold leading-none">{day}</p>
                          <p className="mt-1 text-[11px] uppercase text-muted">{weekday}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{e.title || "Untitled entry"}</p>
                          {e.preview && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{e.preview}</p>}
                          <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
                            {scope === "team" && <span>by {e.owner?.name ?? "a teammate"}</span>}
                            {e.place_name && <span>{e.place_name.split(",")[0]}</span>}
                            {e.tags.slice(0, 4).map((t) => (
                              <span key={t}>#{t}</span>
                            ))}
                            {scope === "mine" && e.is_shared && <span className="text-forest-700">Shared</span>}
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
