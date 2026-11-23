import "server-only";
import { createClient } from "@/lib/supabase/server";
import { viewUrls } from "@/lib/media";
import { sightingTitle, type Observation } from "@/lib/observations";
import { cleanDoc, EMPTY_DOC, liveTitle, mediaIdsIn, searchTerm, withMediaUrls, type DocNode, type SightingNames } from "@/lib/journal-doc";

type Sp = { common_name: string | null; scientific_name: string } | null;

/** Each sighting's current name and the names it had before, so entry titles can follow renames. */
async function sightingNames(observationIds: string[]): Promise<Map<string, SightingNames>> {
  const ids = [...new Set(observationIds)];
  const names = new Map<string, SightingNames>();
  if (ids.length === 0) return names;
  const supabase = await createClient();
  const [{ data: obs }, { data: ids_ }] = await Promise.all([
    supabase.from("observations").select("id, species_guess, species:species_id (common_name, scientific_name)").in("id", ids),
    supabase.from("identifications").select("observation_id, species:species_id (common_name, scientific_name)").in("observation_id", ids),
  ]);
  for (const o of (obs ?? []) as unknown as { id: string; species_guess: string | null; species: Sp }[]) {
    names.set(o.id, { current: sightingTitle(o.species, o.species_guess), past: o.species_guess ? [o.species_guess] : [] });
  }
  for (const i of (ids_ ?? []) as unknown as { observation_id: string; species: Sp }[]) {
    const n = names.get(i.observation_id);
    if (n && i.species) n.past.push(...[i.species.common_name, i.species.scientific_name].filter((x): x is string => !!x));
  }
  return names;
}

/** Applies liveTitle to entries, given each entry's linked sighting ids. */
async function withLiveTitles<T extends { id: string; title: string }>(
  entries: T[],
  linksOf: (e: T) => string[],
): Promise<(T & { sightingNames: string[] })[]> {
  const names = await sightingNames(entries.flatMap(linksOf));
  return entries.map((e) => {
    const linked = linksOf(e).flatMap((id) => (names.has(id) ? [names.get(id)!] : []));
    return { ...e, title: liveTitle(e.title, linked), sightingNames: linked.map((n) => n.current) };
  });
}

export type EntrySummary = {
  id: string;
  owner_id: string;
  title: string;
  entry_date: string;
  place_name: string | null;
  tags: string[];
  is_shared: boolean;
  preview: string;
  owner: { name: string | null } | null;
  sightings: string[]; // names of the linked sightings, as they are now
};

export type Entry = {
  id: string;
  owner_id: string;
  title: string;
  body: DocNode; // with fresh view links on its photos and videos
  entry_date: string;
  place_name: string | null;
  lat: number | null;
  lng: number | null;
  weather: string | null;
  tags: string[];
  is_shared: boolean;
  updated_at: string;
  owner: { name: string | null } | null;
  observationIds: string[];
};

export type JournalFilter = { scope: "mine" | "team"; memberId: string; q?: string; tag?: string; month?: string; observationId?: string };

/** Entries for the journal timeline, newest first. Row-level security keeps other people's private entries out. */
export async function listEntries(f: JournalFilter): Promise<EntrySummary[]> {
  const supabase = await createClient();

  // Only the entries linked to one sighting.
  let onlyIds: string[] | null = null;
  if (f.observationId) {
    if (!/^[0-9a-f-]{36}$/i.test(f.observationId)) return [];
    const { data: links } = await supabase.from("links").select("from_entry_id").eq("to_observation_id", f.observationId);
    onlyIds = [...new Set((links ?? []).flatMap((l) => (l.from_entry_id ? [l.from_entry_id] : [])))];
    if (onlyIds.length === 0) return [];
  }

  let query = supabase
    .from("journal_entries")
    .select("id, owner_id, title, entry_date, place_name, tags, is_shared, body_text, owner:owner_id (name), links (to_observation_id)")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  query = f.scope === "mine" ? query.eq("owner_id", f.memberId) : query.eq("is_shared", true).neq("owner_id", f.memberId);

  if (onlyIds) query = query.in("id", onlyIds);

  const term = searchTerm(f.q ?? "");
  if (term) query = query.or(`title.ilike.%${term}%,body_text.ilike.%${term}%`);
  if (f.tag) query = query.contains("tags", [f.tag]);
  if (f.month && /^\d{4}-\d{2}$/.test(f.month)) {
    const [y, m] = f.month.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    query = query.gte("entry_date", `${f.month}-01`).lt("entry_date", `${next}-01`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  type R = Omit<EntrySummary, "preview" | "sightings"> & { body_text: string | null; links: { to_observation_id: string | null }[] };
  const rows = (data as unknown as R[]).map(({ body_text, links, ...e }) => ({
    ...e,
    preview: (body_text ?? "").replace(/\s+/g, " ").slice(0, 180),
    obsIds: (links ?? []).flatMap((l) => (l.to_observation_id ? [l.to_observation_id] : [])),
  }));
  const live = await withLiveTitles(rows, (e) => e.obsIds);
  return live.map((e) => ({
    id: e.id,
    owner_id: e.owner_id,
    title: e.title,
    entry_date: e.entry_date,
    place_name: e.place_name,
    tags: e.tags,
    is_shared: e.is_shared,
    preview: e.preview,
    owner: e.owner,
    sightings: e.sightingNames,
  }));
}

/** Your tags, most used first, for the filter chips. */
export async function myTags(memberId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("journal_entries").select("tags").eq("owner_id", memberId).limit(1000);
  const counts = new Map<string, number>();
  for (const row of data ?? []) for (const t of row.tags as string[]) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 30);
}

/** One entry, with view links for the photos and videos the reader is allowed to see. */
export async function getEntry(id: string): Promise<Entry | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("journal_entries")
    .select(
      "id, owner_id, title, body, entry_date, place_name, lat, lng, weather, tags, is_shared, updated_at, owner:owner_id (name), links (to_observation_id)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const row = data as unknown as Omit<Entry, "body" | "observationIds"> & {
    body: unknown;
    links: { to_observation_id: string | null }[];
  };

  const body = cleanDoc(row.body) ?? EMPTY_DOC;
  const ids = mediaIdsIn(body);
  const urls = new Map<string, string>();
  if (ids.length) {
    // Only media this reader can see comes back (row-level security).
    const { data: media } = await supabase.from("media").select("id, file_key, media_type").in("id", ids);
    const signed = await viewUrls((media ?? []).map((m) => ({ file_key: m.file_key, media_type: m.media_type })));
    (media ?? []).forEach((m, i) => signed[i].url && urls.set(m.id, signed[i].url!));
  }

  const observationIds = row.links.flatMap((l) => (l.to_observation_id ? [l.to_observation_id] : []));
  const [{ title }] = await withLiveTitles([{ id: row.id, title: row.title }], () => observationIds);

  return {
    id: row.id,
    owner_id: row.owner_id,
    title,
    body: withMediaUrls(body, urls),
    entry_date: row.entry_date,
    place_name: row.place_name,
    lat: row.lat,
    lng: row.lng,
    weather: row.weather,
    tags: row.tags ?? [],
    is_shared: row.is_shared,
    updated_at: row.updated_at,
    owner: row.owner,
    observationIds,
  };
}

/** A sighting as shown in the journal editor's lists. `by` is null for your own. */
export type DaySighting = { id: string; title: string; when: string; thumb: string | null; place: string | null; by: string | null };

export function toDaySighting(o: Observation, me: string): DaySighting {
  return {
    id: o.id,
    title: o.title,
    when: new Date(o.observed_at).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    }),
    thumb: o.media.find((x) => x.media_type === "photo")?.url ?? null,
    place: o.place_name?.split(",")[0] ?? null,
    by: o.observer_id === me ? null : (o.observer?.name ?? "a teammate"),
  };
}

export type LinkedEntry = { id: string; title: string; entry_date: string; owner_id: string; is_shared: boolean; owner: { name: string | null } | null };

/** Journal entries linked to a sighting that this reader may see (row-level security hides private ones). */
export async function entriesForSighting(observationId: string): Promise<LinkedEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("links")
    .select("entry:from_entry_id (id, title, entry_date, owner_id, is_shared, owner:owner_id (name))")
    .eq("to_observation_id", observationId)
    .not("from_entry_id", "is", null);
  if (error) {
    console.error("entries for sighting:", error.message);
    return [];
  }
  const seen = new Set<string>();
  const entries = (data as unknown as { entry: LinkedEntry | null }[])
    .flatMap((r) => (r.entry && !seen.has(r.entry.id) && seen.add(r.entry.id) ? [r.entry] : []))
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  return withLiveTitles(entries, () => [observationId]);
}

/** Your most recent entries, for the "add to an existing entry" picker. */
export async function myRecentEntries(memberId: string): Promise<{ id: string; title: string; entry_date: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("journal_entries")
    .select("id, title, entry_date")
    .eq("owner_id", memberId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}
