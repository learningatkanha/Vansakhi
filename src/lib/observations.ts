import "server-only";
import { createClient } from "@/lib/supabase/server";
import { viewUrls } from "@/lib/media";

const FIELDS = `id, observer_id, observed_at, place_name, lat, lng, count, notes, life_stage, sex, behaviour, habitat, weather, id_status, species_guess,
  species:species_id (id, gbif_key, common_name, scientific_name, hindi_name, group_name),
  observer:observer_id (name),
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
  id_status: "needs_id" | "suggested" | "verified";
  species_guess: string | null;
  species: { id: number; gbif_key: number | null; common_name: string | null; scientific_name: string; hindi_name: string | null; group_name: string | null } | null;
  observer: { name: string | null } | null;
  observation_media: { position: number; media: { id: string; file_key: string; media_type: string } | null }[];
};

export type Observation = Omit<Row, "observation_media"> & {
  title: string;
  media: { id: string; file_key: string; media_type: string; url: string | null }[];
};

async function withMedia(row: Row): Promise<Observation> {
  const ordered = [...row.observation_media].sort((a, b) => a.position - b.position).flatMap((om) => (om.media ? [om.media] : []));
  const title = row.species?.common_name ?? row.species?.scientific_name ?? (row.species_guess ? `${row.species_guess.replace(/\?+$/, "")}?` : "Unknown species");
  return { ...row, title, media: await viewUrls(ordered) };
}

export async function listObservations(
  filter: { needsId?: boolean; observerId?: string; between?: { from: string; to: string }; ids?: string[] },
  limit = 48,
) {
  if (filter.ids && filter.ids.length === 0) return [];
  const supabase = await createClient();
  let query = supabase.from("observations").select(FIELDS).order("observed_at", { ascending: false }).limit(limit);
  if (filter.needsId) query = query.neq("id_status", "verified");
  if (filter.observerId) query = query.eq("observer_id", filter.observerId);
  if (filter.between) query = query.gte("observed_at", filter.between.from).lt("observed_at", filter.between.to);
  if (filter.ids) query = query.in("id", filter.ids);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return Promise.all((data as unknown as Row[]).map(withMedia));
}

export async function getObservation(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("observations").select(FIELDS).eq("id", id).maybeSingle();
  return data ? withMedia(data as unknown as Row) : null;
}

export const STATUS_LABEL = { needs_id: "Needs ID", suggested: "Needs ID", verified: "Verified" } as const;
