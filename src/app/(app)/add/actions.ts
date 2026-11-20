"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type MediaInput = { key: string; kind: "photo" | "video"; mime: string; size: number; takenAt?: string; lat?: number; lng?: number };

export type ObservationInput = {
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
  // Uploads are stored under the uploader's id; refuse keys that belong to anyone else.
  if (input.media.some((m) => !m.key.startsWith(`${member.id}/`))) return { error: "One of the uploads is not yours." };

  const supabase = await createClient();

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

  const count = input.count && input.count > 0 ? Math.min(Math.round(input.count), 100000) : null;
  const { data: obs, error } = await supabase
    .from("observations")
    .insert({
      observer_id: member.id,
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
      id_status: speciesId ? "suggested" : "needs_id",
    })
    .select("id")
    .single();
  if (error || !obs) {
    console.error("save observation:", error?.message);
    return { error: "Could not save the observation. Please try again." };
  }

  if (speciesId) {
    await supabase.from("identifications").insert({ observation_id: obs.id, member_id: member.id, species_id: speciesId, source: "manual" });
  }

  if (input.media.length > 0) {
    const { data: rows, error: mediaError } = await supabase
      .from("media")
      .insert(
        input.media.map((m) => ({
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
    const order = new Map(input.media.map((m, i) => [m.key, i]));
    await supabase
      .from("observation_media")
      .insert(rows.map((r) => ({ observation_id: obs.id, media_id: r.id, position: order.get(r.file_key) ?? 0 })));
  }

  revalidatePath("/");
  redirect(`/observations/${obs.id}`);
}
