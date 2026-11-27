import "server-only";
import { createClient } from "@/lib/supabase/server";
import { viewUrls } from "@/lib/media";
import { byNearness } from "@/lib/journal-doc";
import type { IdStatus } from "@/lib/id-status";
import { CATEGORIES, GROUPS, NAMED_GROUPS, categoryOf, type Category } from "@/lib/categories";

const FIELDS = `id, observer_id, observed_at, place_name, lat, lng, count, notes, life_stage, sex, behaviour, habitat, weather, id_status, species_guess,
  species:species_id (id, gbif_key, common_name, scientific_name, hindi_name, group_name),
  observer:observer_id (name),
  verified_at, verifier:verified_by (name),
  observation_media (position, media:media_id (id, file_key, media_type))`;

type Row = {
  id: string;
  observer_id: string;
  observed_at: string;
  place_name: string | null;
  lat: number | null;
  lng: number | null;
  count: number | null;
  notes: string | null;
  life_stage: string | null;
  sex: string | null;
  behaviour: string | null;
  habitat: string | null;
  weather: string | null;
  id_status: IdStatus;
  verified_at: string | null;
  verifier: { name: string | null } | null;
  species_guess: string | null;
  species: { id: number; gbif_key: number | null; common_name: string | null; scientific_name: string; hindi_name: string | null; group_name: string | null } | null;
  observer: { name: string | null } | null;
  observation_media: { position: number; media: { id: string; file_key: string; media_type: string } | null }[];
};

export type Observation = Omit<Row, "observation_media"> & {
  title: string;
  media: { id: string; file_key: string; media_type: string; url: string | null }[];
};

/** A sighting's display name: the species, else the guess with a "?", else "Unknown species". */
export function sightingTitle(species: { common_name: string | null; scientific_name: string } | null, guess: string | null) {
  return species?.common_name ?? species?.scientific_name ?? (guess ? `${guess.replace(/\?+$/, "")}?` : "Unknown species");
}

async function withMedia(row: Row): Promise<Observation> {
  const ordered = [...row.observation_media].sort((a, b) => a.position - b.position).flatMap((om) => (om.media ? [om.media] : []));
  return { ...row, title: sightingTitle(row.species, row.species_guess), media: await viewUrls(ordered) };
}

export async function listObservations(
  filter: {
    needsId?: boolean;
    status?: IdStatus;
    observerId?: string;
    between?: { from: string; to: string };
    ids?: string[];
    notVerified?: boolean;
    category?: Category;
  },
  limit = 48,
) {
  if (filter.ids && filter.ids.length === 0) return [];
  const supabase = await createClient();
  const byGroup = filter.category && filter.category !== "unnamed";
  // To filter on the species' group, the species must be joined as required ("!inner").
  const fields = byGroup ? FIELDS.replace("species:species_id (", "species:species_id!inner (") : FIELDS;
  let query = supabase.from("observations").select(fields).order("observed_at", { ascending: false }).limit(limit);
  if (filter.category === "unnamed") query = query.is("species_id", null);
  else if (filter.category === "others")
    query = query.or(`group_name.is.null,group_name.not.in.(${NAMED_GROUPS.join(",")})`, { referencedTable: "species" });
  else if (filter.category) query = query.in("species.group_name", GROUPS[filter.category]);
  if (filter.needsId) query = query.eq("id_status", "needs_id");
  if (filter.status) query = query.eq("id_status", filter.status);
  if (filter.notVerified) query = query.neq("id_status", "verified");
  if (filter.observerId) query = query.eq("observer_id", filter.observerId);
  if (filter.between) query = query.gte("observed_at", filter.between.from).lt("observed_at", filter.between.to);
  if (filter.ids) query = query.in("id", filter.ids);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return Promise.all((data as unknown as Row[]).map(withMedia));
}

/** Words safe to put inside a PostgREST `or(...)` filter: letters, digits, spaces and a few name characters. */
export function cleanSearch(q: string) {
  return q.replace(/[^\p{L}\p{N}\s.'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

/**
 * Sightings from any day whose species name (English, scientific or Hindi), guess or place contains `q`
 * (empty `q` = all). Your teammates' sightings are included (the database's privacy rules decide what you can see).
 * Newest first; or, given a `day`, that day's first and then the nearest days.
 */
export async function searchObservations(q: string, limit = 20, day?: { from: string; to: string }) {
  const words = cleanSearch(q);
  const supabase = await createClient();
  let match: string | null = null;
  if (words) {
    const like = `%${words}%`;
    const { data: species } = await supabase
      .from("species")
      .select("id")
      .or(`common_name.ilike.${like},scientific_name.ilike.${like},hindi_name.ilike.${like}`)
      .limit(200);
    const speciesIds = (species ?? []).map((s: { id: number }) => s.id);
    const conditions = [`species_guess.ilike.${like}`, `place_name.ilike.${like}`];
    if (speciesIds.length) conditions.push(`species_id.in.(${speciesIds.join(",")})`);
    match = conditions.join(",");
  }
  const base = () => {
    const query = supabase.from("observations").select(FIELDS);
    return match ? query.or(match) : query;
  };
  const rows = async (query: ReturnType<typeof base>) => {
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as unknown as Row[];
  };

  if (!day) return Promise.all((await rows(base().order("observed_at", { ascending: false }).limit(limit))).map(withMedia));

  // Up to `limit` on or before the day (going back) and up to `limit` after it (going forward), then the closest.
  const [before, after] = await Promise.all([
    rows(base().lt("observed_at", day.to).order("observed_at", { ascending: false }).limit(limit)),
    rows(base().gte("observed_at", day.to).order("observed_at", { ascending: true }).limit(limit)),
  ]);
  return Promise.all(byNearness([...before, ...after], day).slice(0, limit).map(withMedia));
}

export async function getObservation(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("observations").select(FIELDS).eq("id", id).maybeSingle();
  return data ? withMedia(data as unknown as Row) : null;
}

/** Your own recent sightings, light (no photos), for pick-lists. Unnamed ones first. */
export async function myRecentSightings(memberId: string, limit = 40) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("observations")
    .select("id, observed_at, place_name, species_guess, species:species_id (common_name, scientific_name)")
    .eq("observer_id", memberId)
    .order("observed_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  type R = { id: string; observed_at: string; place_name: string | null; species_guess: string | null; species: { common_name: string | null; scientific_name: string } | null };
  const rows = (data as unknown as R[]).map((r) => ({
    id: r.id,
    observedAt: r.observed_at,
    place: r.place_name,
    named: !!r.species,
    title: sightingTitle(r.species, r.species_guess),
  }));
  return [...rows.filter((r) => !r.named), ...rows.filter((r) => r.named)];
}

export type RecentSighting = Awaited<ReturnType<typeof myRecentSightings>>[number];

export { STATUS_LABEL } from "@/lib/id-status";

export type Suggestion = {
  id: number;
  member_id: string;
  comment: string | null;
  created_at: string;
  species: { id: number; common_name: string | null; scientific_name: string; hindi_name: string | null } | null;
  member: { name: string | null } | null;
};

/** Names suggested for a sighting (by anyone, the owner included), oldest first. */
export async function suggestionsFor(observationId: string): Promise<Suggestion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("identifications")
    .select("id, member_id, comment, created_at, species:species_id (id, common_name, scientific_name, hindi_name), member:member_id (name)")
    .eq("observation_id", observationId)
    .eq("source", "suggestion")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("suggestions:", error.message);
    return [];
  }
  return data as unknown as Suggestion[];
}

/** Sightings with at least one name suggestion. */
async function idsWithSuggestions(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("identifications").select("observation_id").eq("source", "suggestion").limit(2000);
  return [...new Set((data ?? []).map((r: { observation_id: string }) => r.observation_id))];
}

export type ReviewTab = "needs-id" | "named" | "suggestions";

/** The researchers' Review page: sightings waiting for an expert eye (Self-confirmed and Verified ones aren't listed). */
export async function reviewList(tab: ReviewTab, limit = 60) {
  if (tab === "needs-id") return listObservations({ status: "needs_id" }, limit);
  if (tab === "named") return listObservations({ status: "suggested" }, limit);
  return listObservations({ ids: await idsWithSuggestions(), notVerified: true }, limit);
}

/** How many sightings wait in each Review tab. */
export async function reviewCounts(): Promise<Record<ReviewTab, number>> {
  const supabase = await createClient();
  const count = async (status: IdStatus) => {
    const { count: n } = await supabase.from("observations").select("id", { count: "exact", head: true }).eq("id_status", status);
    return n ?? 0;
  };
  const ids = await idsWithSuggestions();
  const [needsId, named, suggestions] = await Promise.all([
    count("needs_id"),
    count("suggested"),
    ids.length
      ? supabase
          .from("observations")
          .select("id", { count: "exact", head: true })
          .in("id", ids.slice(0, 500))
          .neq("id_status", "verified")
          .then((r) => r.count ?? 0)
      : Promise.resolve(0),
  ]);
  return { "needs-id": needsId, named, suggestions };
}

/** How many sightings are in each type tab (and in total), with the same person / Needs ID filter as the list. */
export async function categoryCounts(filter: { needsId?: boolean; observerId?: string }) {
  const supabase = await createClient();
  let query = supabase.from("observations").select("species:species_id (group_name)").limit(10000);
  if (filter.needsId) query = query.eq("id_status", "needs_id");
  if (filter.observerId) query = query.eq("observer_id", filter.observerId);
  const { data, error } = await query;
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c.key, 0])) as Record<Category, number>;
  if (error) {
    console.error("category counts:", error.message);
    return { all: 0, ...counts };
  }
  for (const row of data as unknown as { species: { group_name: string | null } | null }[]) counts[categoryOf(row.species)]++;
  return { all: data.length, ...counts };
}
