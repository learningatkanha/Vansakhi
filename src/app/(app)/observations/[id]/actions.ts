"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { speciesFromForm, speciesRowId } from "@/lib/species-rows";

export async function deleteObservation(formData: FormData) {
  await getCurrentMember();
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  // Row-level security allows this only for the observer (or an admin).
  const { error } = await supabase.from("observations").delete().eq("id", id);
  if (error) console.error("delete observation:", error.message);
  revalidatePath("/");
  redirect("/");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SuggestState = { error?: string; done?: boolean };

/** Anyone on the team suggests a name for a sighting: someone else's, or their own when unsure. */
export async function suggestName(_prev: SuggestState, formData: FormData): Promise<SuggestState> {
  const member = await getCurrentMember();
  const observationId = String(formData.get("observationId") ?? "");
  const species = speciesFromForm(formData.get("species"));
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;
  if (!UUID.test(observationId)) return { error: "Missing sighting." };
  if (!species) return { error: "Please choose a species first." };

  const supabase = await createClient();
  const { data: obs } = await supabase.from("observations").select("id").eq("id", observationId).maybeSingle();
  if (!obs) return { error: "That sighting could not be found." };

  const speciesId = await speciesRowId(supabase, species);
  if (!speciesId) return { error: "Could not save the species. Please try again." };
  const { data: already } = await supabase
    .from("identifications")
    .select("id")
    .eq("observation_id", observationId)
    .eq("member_id", member.id)
    .eq("species_id", speciesId)
    .eq("source", "suggestion")
    .maybeSingle();
  if (already) return { error: "You have already suggested this species here." };

  const { error } = await supabase
    .from("identifications")
    .insert({ observation_id: observationId, member_id: member.id, species_id: speciesId, source: "suggestion", comment: note });
  if (error) {
    console.error("suggest name:", error.message);
    return { error: "Could not save your suggestion. Please try again." };
  }
  revalidatePath(`/observations/${observationId}`);
  return { done: true };
}

/** The sighting's owner takes a suggested name: the sighting becomes "Named" with that species. */
export async function acceptSuggestion(formData: FormData) {
  const member = await getCurrentMember();
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id)) return;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("identifications")
    .select("observation_id, species_id, observation:observation_id (observer_id, species_id)")
    .eq("id", id)
    .maybeSingle();
  const s = row as unknown as { observation_id: string; species_id: number; observation: { observer_id: string; species_id: number | null } | null } | null;
  if (!s?.observation || s.observation.observer_id !== member.id) return;
  if (s.observation.species_id !== s.species_id) {
    const { error } = await supabase
      .from("observations")
      .update({ species_id: s.species_id, species_guess: null, id_status: "suggested" })
      .eq("id", s.observation_id);
    if (error) console.error("accept suggestion:", error.message);
  }
  revalidatePath(`/observations/${s.observation_id}`);
  revalidatePath("/");
}

/** Withdraw your own suggestion, or (admin) delete anyone's. Row-level security decides. */
export async function deleteSuggestion(formData: FormData) {
  await getCurrentMember();
  const id = Number(formData.get("id"));
  const observationId = String(formData.get("observationId") ?? "");
  if (!Number.isSafeInteger(id) || !UUID.test(observationId)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("identifications").delete().eq("id", id);
  if (error) console.error("delete suggestion:", error.message);
  revalidatePath(`/observations/${observationId}`);
}
