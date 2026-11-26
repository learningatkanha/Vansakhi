"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { speciesFromForm, speciesRowId } from "@/lib/species-rows";
import { isReviewerRole, statusAfterNaming, type IdStatus } from "@/lib/id-status";

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

/**
 * Takes a suggested name. mode "named" / "sure": the sighting's owner accepts it (Named, or Self-confirmed /
 * Verified when they're sure). mode "verify": a researcher or admin accepts it and verifies it in one go.
 */
export async function acceptSuggestion(formData: FormData) {
  const member = await getCurrentMember();
  const id = Number(formData.get("id"));
  const mode = String(formData.get("mode") ?? "named");
  if (!Number.isSafeInteger(id)) return;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("identifications")
    .select("observation_id, species_id, observation:observation_id (observer_id, species_id, id_status)")
    .eq("id", id)
    .maybeSingle();
  const s = row as unknown as {
    observation_id: string;
    species_id: number;
    observation: { observer_id: string; species_id: number | null; id_status: IdStatus } | null;
  } | null;
  if (!s?.observation) return;

  if (mode === "verify") {
    if (!isReviewerRole(member.role)) return;
    const { error } = await supabase.rpc("review_observation", { p_id: s.observation_id, p_status: "verified", p_species_id: s.species_id });
    if (error) console.error("accept and verify:", error.message);
  } else {
    if (s.observation.observer_id !== member.id) return;
    const speciesChanged = s.observation.species_id !== s.species_id;
    const idStatus = statusAfterNaming({
      named: true,
      sure: mode === "sure",
      reviewer: isReviewerRole(member.role),
      current: s.observation.id_status,
      speciesChanged,
    });
    const { error } = await supabase
      .from("observations")
      .update({ species_id: s.species_id, species_guess: null, id_status: idStatus })
      .eq("id", s.observation_id);
    if (error) console.error("accept suggestion:", error.message);
  }
  revalidatePath(`/observations/${s.observation_id}`);
  revalidatePath("/");
  revalidatePath("/review");
}

/** The owner, now sure of their sighting's name, marks it Self-confirmed (Verified for researchers). */
export async function markSure(formData: FormData) {
  const member = await getCurrentMember();
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  const { data: obs } = await supabase.from("observations").select("observer_id, species_id, id_status").eq("id", id).maybeSingle();
  if (!obs || obs.observer_id !== member.id || obs.species_id === null) return;
  const idStatus = statusAfterNaming({ named: true, sure: true, reviewer: isReviewerRole(member.role), current: obs.id_status as IdStatus, speciesChanged: false });
  const { error } = await supabase.from("observations").update({ id_status: idStatus }).eq("id", id);
  if (error) console.error("mark sure:", error.message);
  revalidatePath(`/observations/${id}`);
  revalidatePath("/");
  revalidatePath("/review");
}

export type ReviewState = { error?: string; done?: boolean };

/**
 * Researcher / admin review of anyone's sighting: "verify" the current name, "name" it with a chosen species and
 * verify, or "undo" a verification (back to Named, so it shows up for review again).
 */
export async function reviewSighting(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const member = await getCurrentMember();
  if (!isReviewerRole(member.role)) return { error: "Only researchers can do this." };
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "");
  if (!UUID.test(id)) return { error: "Missing sighting." };
  const supabase = await createClient();

  let status: IdStatus;
  let speciesId: number | null = null;
  if (action === "verify") status = "verified";
  else if (action === "undo") status = "suggested";
  else if (action === "name") {
    const species = speciesFromForm(formData.get("species"));
    if (!species) return { error: "Please choose a species first." };
    speciesId = await speciesRowId(supabase, species);
    if (!speciesId) return { error: "Could not save the species. Please try again." };
    status = "verified";
  } else return { error: "Unknown action." };

  if (action === "verify") {
    const { data: obs } = await supabase.from("observations").select("species_id").eq("id", id).maybeSingle();
    if (!obs?.species_id) return { error: "Give it a name first (Name & verify)." };
  }
  const { data: ok, error } = await supabase.rpc("review_observation", { p_id: id, p_status: status, p_species_id: speciesId });
  if (error || !ok) {
    console.error("review sighting:", error?.message ?? "not allowed");
    return { error: "Could not save. Has database update 0011 been run in Supabase?" };
  }
  revalidatePath(`/observations/${id}`);
  revalidatePath("/");
  revalidatePath("/review");
  return { done: true };
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
