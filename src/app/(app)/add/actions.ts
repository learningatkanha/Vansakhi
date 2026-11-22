"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type MediaInput = {
  key: string;
  kind: "photo" | "video";
  mime: string;
  size: number;
  takenAt?: string;
  lat?: number;
  lng?: number;
  mediaId?: string; // a photo already attached to the sighting being edited
};

export type ObservationInput = {
  id?: string; // set when editing an existing sighting
  species: { gbifKey: number; scientificName: string; commonName: string | null; hindiName: string | null; group: string | null } | null;
  speciesGuess: string;
  observedAt: string; // ISO
  place: { name: string; lat: number; lng: number } | null;
  count: number | null;
  notes: string;
  details: { life_stage?: string; sex?: string; behaviour?: string; habitat?: string; weather?: string };
  media: MediaInput[];
};

export type SaveState = { error?: string };

const point = (lat: number, lng: number) => `SRID=4326;POINT(${lng} ${lat})`;
const okCoord = (lat?: number, lng?: number) =>
  typeof lat === "number" && typeof lng === "number" && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
const clip = (s: unknown, n = 2000) => String(s ?? "").trim().slice(0, n) || null;

export async function saveObservation(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const member = await getCurrentMember();
  let input: ObservationInput;
  try {
    input = JSON.parse(String(formData.get("payload")));
  } catch {
    return { error: "Something went wrong reading the form. Please try again." };
  }

  const observedAt = new Date(input.observedAt);
  if (isNaN(+observedAt)) return { error: "Please enter the date and time of the sighting." };
  if (+observedAt > Date.now() + 5 * 60_000) return { error: "The sighting date can't be in the future." };
  if (!input.species && !input.speciesGuess.trim() && input.media.length === 0)
    return { error: "Add a photo or video, or name the species." };
  const newMedia = input.media.filter((m) => !m.mediaId);
  // Uploads are stored under the uploader's id; refuse keys that belong to anyone else.
  if (newMedia.some((m) => !m.key.startsWith(`${member.id}/`))) return { error: "One of the uploads is not yours." };

  const supabase = await createClient();

  // When editing: load the sighting as it is now. Row-level security only lets you change your own.
  let existing: { species_id: number | null; mediaIds: string[] } | null = null;
  if (input.id) {
    const { data } = await supabase
      .from("observations")
      .select("species_id, observer_id, observation_media (media_id)")
      .eq("id", input.id)
      .maybeSingle();
    if (!data || data.observer_id !== member.id) return { error: "You can only edit your own sightings." };
    existing = { species_id: data.species_id, mediaIds: (data.observation_media ?? []).map((om) => om.media_id) };
    if (input.media.some((m) => m.mediaId && !existing!.mediaIds.includes(m.mediaId)))
      return { error: "One of the photos doesn't belong to this sighting." };
  }

  let speciesId: number | null = null;
  if (input.species) {
    const s = input.species;
    await supabase.from("species").upsert(
      { gbif_key: s.gbifKey, scientific_name: s.scientificName, common_name: s.commonName, hindi_name: s.hindiName, group_name: s.group },
      { onConflict: "gbif_key", ignoreDuplicates: true },
    );
    const { data } = await supabase.from("species").select("id").eq("gbif_key", s.gbifKey).single();
    speciesId = data?.id ?? null;
  }
  const speciesChanged = !existing || existing.species_id !== speciesId;

  const count = input.count && input.count > 0 ? Math.min(Math.round(input.count), 100000) : null;
  const row = {
    species_id: speciesId,
    species_guess: speciesId ? null : clip(input.speciesGuess, 200),
    observed_at: observedAt.toISOString(),
    place_name: input.place ? clip(input.place.name, 300) : null,
    location: input.place && okCoord(input.place.lat, input.place.lng) ? point(input.place.lat, input.place.lng) : null,
    count,
    notes: clip(input.notes),
    life_stage: clip(input.details.life_stage, 100),
    sex: clip(input.details.sex, 50),
    behaviour: clip(input.details.behaviour, 500),
    habitat: clip(input.details.habitat, 500),
    weather: clip(input.details.weather, 200),
    // Keep a team-verified status unless the species itself was changed.
    ...(speciesChanged ? { id_status: speciesId ? ("suggested" as const) : ("needs_id" as const) } : {}),
  };

  const { data: obs, error } = input.id
    ? await supabase.from("observations").update(row).eq("id", input.id).select("id").maybeSingle()
    : await supabase.from("observations").insert({ ...row, observer_id: member.id }).select("id").single();
  if (error || !obs) {
    console.error("save observation:", error?.message);
    return { error: "Could not save the observation. Please try again." };
  }

  if (speciesId && speciesChanged) {
    await supabase.from("identifications").insert({ observation_id: obs.id, member_id: member.id, species_id: speciesId, source: "manual" });
  }

  // New uploads get a media row each; photos already on the sighting keep theirs.
  const mediaIdByKey = new Map(input.media.filter((m) => m.mediaId).map((m) => [m.key, m.mediaId!]));
  if (newMedia.length > 0) {
    const { data: rows, error: mediaError } = await supabase
      .from("media")
      .insert(
        newMedia.map((m) => ({
          owner_id: member.id,
          file_key: m.key,
          media_type: m.kind,
          mime_type: m.mime,
          size_bytes: m.size,
          taken_at: m.takenAt ?? null,
          location: okCoord(m.lat, m.lng) ? point(m.lat!, m.lng!) : null,
        })),
      )
      .select("id, file_key");
    if (mediaError || !rows) {
      console.error("save media:", mediaError?.message);
      return { error: "The observation was saved, but its photos could not be attached." };
    }
    for (const r of rows) mediaIdByKey.set(r.file_key, r.id);
  }

  // Attach photos in the order shown. Removed photos are only detached; they stay in your media library.
  if (existing) await supabase.from("observation_media").delete().eq("observation_id", obs.id);
  const links = input.media.flatMap((m, i) => {
    const mediaId = mediaIdByKey.get(m.key);
    return mediaId ? [{ observation_id: obs.id, media_id: mediaId, position: i }] : [];
  });
  if (links.length > 0) {
    const { error: linkError } = await supabase.from("observation_media").insert(links);
    if (linkError) {
      console.error("attach media:", linkError.message);
      return { error: "The observation was saved, but its photos could not be attached." };
    }
  }

  revalidatePath("/");
  revalidatePath(`/observations/${obs.id}`);
  // A new sighting lands on its page with a prompt to write about it in the journal.
  redirect(input.id ? `/observations/${obs.id}` : `/observations/${obs.id}?saved=1`);
}
