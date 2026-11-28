import "server-only";
import { createClient } from "@/lib/supabase/server";
import { viewUrls } from "@/lib/media";
import { KIND_GROUP, type CreationKind, type KindTab } from "@/lib/creation-kinds";

/** Creative Adda: creations (paintings, stories, poems, audio, anything) inspired by sightings or by Kanha. */

export type CreationMedia = { id: string; file_key: string; media_type: string; position: number; url: string | null };
export type InspiringSighting = {
  id: string;
  title: string;
  observed_at: string;
  observer_name: string | null;
  observer_id: string;
  photo: string | null;
};

export type Creation = {
  id: string;
  author_id: string;
  kind: CreationKind;
  title: string;
  text_body: string | null;
  moved_note: string | null;
  link_url: string | null;
  created_at: string;
  updated_at: string;
  author: { name: string | null } | null;
  media: CreationMedia[];
  moved: { member_id: string; name: string | null }[];
  sightingIds: string[];
};

const FIELDS = `
  id, author_id, kind, title, text_body, moved_note, link_url, created_at, updated_at,
  author:author_id (name),
  creation_media (position, media:media_id (id, file_key, media_type)),
  creation_reactions (member_id, member:member_id (name)),
  creation_links (observation_id)
`;

type Row = Omit<Creation, "media" | "moved" | "sightingIds"> & {
  creation_media: { position: number; media: { id: string; file_key: string; media_type: string } | null }[];
  creation_reactions: { member_id: string; member: { name: string | null } | null }[];
  creation_links: { observation_id: string }[];
};

async function shape(r: Row): Promise<Creation> {
  const media = r.creation_media
    .filter((m) => m.media)
    .sort((a, b) => a.position - b.position)
    .map((m) => ({ ...m.media!, position: m.position }));
  const { creation_media: _m, creation_reactions, creation_links, ...rest } = r;
  void _m;
  return {
    ...rest,
    media: await viewUrls(media),
    moved: creation_reactions.map((x) => ({ member_id: x.member_id, name: x.member?.name ?? null })),
    sightingIds: creation_links.map((l) => l.observation_id),
  };
}

/** The gallery, newest first; optionally one tab (Paintings, Stories, Poems, Audio, Others). */
export async function listCreations(tab: KindTab = "all", limit = 60): Promise<Creation[]> {
  const supabase = await createClient();
  let query = supabase.from("creations").select(FIELDS).order("created_at", { ascending: false }).limit(limit);
  if (tab !== "all") query = query.in("kind", Object.keys(KIND_GROUP).filter((k) => KIND_GROUP[k as CreationKind] === tab));
  const { data, error } = await query;
  if (error) {
    console.error("list creations:", error.message);
    return [];
  }
  return Promise.all((data as unknown as Row[]).map(shape));
}

/** How many creations are in each gallery tab. */
export async function creationCounts(): Promise<Record<KindTab, number>> {
  const supabase = await createClient();
  const { data } = await supabase.from("creations").select("kind").limit(10000);
  const counts: Record<KindTab, number> = { all: 0, paintings: 0, stories: 0, poems: 0, audio: 0, others: 0 };
  for (const r of (data ?? []) as { kind: CreationKind }[]) {
    counts.all++;
    counts[KIND_GROUP[r.kind] ?? "others"]++;
  }
  return counts;
}

export async function getCreation(id: string): Promise<Creation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("creations").select(FIELDS).eq("id", id).maybeSingle();
  if (error) console.error("get creation:", error.message);
  return data ? shape(data as unknown as Row) : null;
}

/** The sightings behind a creation, with a photo each, for "Inspired by" and the side-by-side view. */
export async function inspiringSightings(ids: string[]): Promise<InspiringSighting[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("observations")
    .select(
      "id, observed_at, observer_id, species_guess, species:species_id (common_name, scientific_name), observer:observer_id (name), observation_media (position, media:media_id (file_key, media_type))",
    )
    .in("id", ids);
  type R = {
    id: string;
    observed_at: string;
    observer_id: string;
    species_guess: string | null;
    species: { common_name: string | null; scientific_name: string } | null;
    observer: { name: string | null } | null;
    observation_media: { position: number; media: { file_key: string; media_type: string } | null }[];
  };
  return Promise.all(
    ((data ?? []) as unknown as R[]).map(async (o) => {
      const cover = o.observation_media
        .filter((m) => m.media?.media_type === "photo")
        .sort((a, b) => a.position - b.position)[0]?.media;
      const [withUrl] = cover ? await viewUrls([cover]) : [null];
      return {
        id: o.id,
        title: o.species?.common_name ?? o.species?.scientific_name ?? (o.species_guess ? `${o.species_guess}?` : "Unknown species"),
        observed_at: o.observed_at,
        observer_id: o.observer_id,
        observer_name: o.observer?.name ?? null,
        photo: withUrl?.url ?? null,
      };
    }),
  );
}

/** Creations inspired by one sighting (for "Inspired by this sighting"). */
export async function creationsForSighting(observationId: string): Promise<Creation[]> {
  const supabase = await createClient();
  const { data: links } = await supabase.from("creation_links").select("creation_id").eq("observation_id", observationId);
  const ids = (links ?? []).map((l: { creation_id: string }) => l.creation_id);
  if (ids.length === 0) return [];
  const { data } = await supabase.from("creations").select(FIELDS).in("id", ids).order("created_at", { ascending: false });
  return Promise.all(((data ?? []) as unknown as Row[]).map(shape));
}
