"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { speciesRowId } from "@/lib/species-rows";
import { isReviewerRole, statusAfterNaming, type IdStatus } from "@/lib/id-status";
import { sightingTitle } from "@/lib/observations";

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
  sure: boolean; // "I'm sure" (Self-confirmed, or Verified for researchers) vs "Not sure" (Named)
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

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The sighting's display name as it is in the database right now. */
async function titleNow(supabase: Supabase, observationId: string) {
  const { data } = await supabase
    .from("observations")
    .select("species_guess, species:species_id (common_name, scientific_name)")
    .eq("id", observationId)
    .maybeSingle();
  const row = data as unknown as { species_guess: string | null; species: { common_name: string | null; scientific_name: string } | null } | null;
  return row ? sightingTitle(row.species, row.species_guess) : null;
}

/**
 * After a sighting is renamed, your journal entries about it that still carry its old name as their
 * title (as filled in when you started writing) take the new name. Titles you changed are left alone.
 */
async function retitleEntries(supabase: Supabase, memberId: string, observationId: string, oldTitle: string | null, newTitle: string | null) {
  if (!oldTitle || !newTitle || oldTitle === newTitle) return;
  const { data: links } = await supabase.from("links").select("from_entry_id").eq("to_observation_id", observationId);
  const ids = (links ?? []).flatMap((l) => (l.from_entry_id ? [l.from_entry_id] : []));
  if (ids.length === 0) return;
  const { error } = await supabase.from("journal_entries").update({ title: newTitle }).in("id", ids).eq("owner_id", memberId).eq("title", oldTitle);
  if (error) console.error("retitle journal entries:", error.message);
  revalidatePath("/journal");
  for (const id of ids) revalidatePath(`/journal/${id}`);
}

export type NameState = { error?: string };

/** From the Explore page: put the chosen species on one of your own sightings. */
export async function nameSighting(_prev: NameState, formData: FormData): Promise<NameState> {
  const member = await getCurrentMember();
  const observationId = String(formData.get("observationId") ?? "");
  let species: NonNullable<ObservationInput["species"]>;
  try {
    species = JSON.parse(String(formData.get("species")));
    if (typeof species?.gbifKey !== "number" || !species.scientificName) throw new Error();
  } catch {
    return { error: "Please choose a species first." };
  }
  if (!/^[0-9a-f-]{36}$/i.test(observationId)) return { error: "Please choose one of your sightings." };
  const sureValue = formData.get("sure");
  if (sureValue !== "1" && sureValue !== "0") return { error: "Please choose \"I'm sure\" or \"Not sure\"." };

  const supabase = await createClient();
  const { data: obs } = await supabase.from("observations").select("observer_id, species_id, id_status").eq("id", observationId).maybeSingle();
  if (!obs || obs.observer_id !== member.id) return { error: "You can only name your own sightings." };

  const speciesId = await speciesRowId(supabase, species);
  if (!speciesId) return { error: "Could not save the species. Please try again." };

  const speciesChanged = obs.species_id !== speciesId;
  const idStatus = statusAfterNaming({
    named: true,
    sure: sureValue === "1",
    reviewer: isReviewerRole(member.role),
    current: obs.id_status as IdStatus,
    speciesChanged,
  });
  if (speciesChanged || idStatus !== obs.id_status) {
    const oldTitle = await titleNow(supabase, observationId);
    const { error } = await supabase
      .from("observations")
      .update({ species_id: speciesId, species_guess: null, id_status: idStatus })
      .eq("id", observationId);
    if (error) {
      console.error("name sighting:", error.message);
      return { error: "Could not save the species. Please try again." };
    }
    if (speciesChanged)
      await supabase.from("identifications").insert({ observation_id: observationId, member_id: member.id, species_id: speciesId, source: "manual" });
    await retitleEntries(supabase, member.id, observationId, oldTitle, await titleNow(supabase, observationId));
  }

  revalidatePath("/");
  revalidatePath(`/observations/${observationId}`);
  redirect(`/observations/${observationId}`);
}

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
  let existing: { species_id: number | null; id_status: IdStatus; mediaIds: string[] } | null = null;
  if (input.id) {
    const { data } = await supabase
      .from("observations")
      .select("species_id, id_status, observer_id, observation_media (media_id)")
      .eq("id", input.id)
      .maybeSingle();
    if (!data || data.observer_id !== member.id) return { error: "You can only edit your own sightings." };
    existing = { species_id: data.species_id, id_status: data.id_status as IdStatus, mediaIds: (data.observation_media ?? []).map((om) => om.media_id) };
    if (input.media.some((m) => m.mediaId && !existing!.mediaIds.includes(m.mediaId)))
      return { error: "One of the photos doesn't belong to this sighting." };
  }
  const oldTitle = input.id ? await titleNow(supabase, input.id) : null;

  const speciesId = input.species ? await speciesRowId(supabase, input.species) : null;
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
    id_status: statusAfterNaming({
      named: speciesId !== null,
      sure: input.sure === true,
      reviewer: isReviewerRole(member.role),
      current: existing?.id_status ?? null,
      speciesChanged,
    }),
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
  if (input.id) await retitleEntries(supabase, member.id, obs.id, oldTitle, await titleNow(supabase, obs.id));

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
