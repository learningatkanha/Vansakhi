"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedViewUrl } from "@/lib/r2";
import { listObservations, searchObservations } from "@/lib/observations";
import { toDaySighting, type DaySighting } from "@/lib/journal";
import { cleanDoc, docText, istDayRange, mediaIdsIn, parseTags, todayIST, withMediaUrls } from "@/lib/journal-doc";

export type EntryInput = {
  id: string | null;
  title: string;
  body: unknown;
  entryDate: string; // "2026-11-20"
  place: { name: string; lat: number; lng: number } | null;
  weather: string;
  tags: string;
  isShared: boolean;
  observationIds: string[];
};

export type SaveState = { error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const point = (lat: number, lng: number) => `SRID=4326;POINT(${lng} ${lat})`;
const okCoord = (lat?: number, lng?: number) =>
  typeof lat === "number" && typeof lng === "number" && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
const clip = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n) || null;

export async function saveEntry(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const member = await getCurrentMember();
  let input: EntryInput;
  try {
    input = JSON.parse(String(formData.get("payload")));
  } catch {
    return { error: "Something went wrong reading the entry. Please try again." };
  }

  let body = cleanDoc(input.body);
  if (!body) return { error: "Something went wrong reading the entry. Please try again." };
  if (JSON.stringify(body).length > 1_000_000) return { error: "This entry is too long. Please split it into two." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.entryDate) || input.entryDate > todayIST())
    return { error: "Please choose a date that isn't in the future." };
  if (input.id !== null && !UUID.test(input.id)) return { error: "This entry no longer exists." };

  const supabase = await createClient();

  // Keep only photos and videos you uploaded yourself.
  const mediaIds = mediaIdsIn(body);
  let ownMedia: string[] = [];
  if (mediaIds.length) {
    const { data } = await supabase.from("media").select("id").in("id", mediaIds).eq("owner_id", member.id);
    ownMedia = (data ?? []).map((m) => m.id);
    if (ownMedia.length < mediaIds.length) body = cleanDoc(withMediaUrls(body, new Map(ownMedia.map((id) => [id, "-"]))))!;
  }

  const wanted = [...new Set((input.observationIds ?? []).filter((id) => UUID.test(id)))].slice(0, 100);
  let observationIds: string[] = [];
  if (wanted.length) {
    const { data } = await supabase.from("observations").select("id").in("id", wanted);
    observationIds = (data ?? []).map((o) => o.id);
  }

  const row = {
    title: clip(input.title, 200) ?? "",
    body,
    body_text: docText(body).slice(0, 200_000),
    entry_date: input.entryDate,
    place_name: input.place ? clip(input.place.name, 300) : null,
    location: input.place && okCoord(input.place.lat, input.place.lng) ? point(input.place.lat, input.place.lng) : null,
    weather: clip(input.weather, 200),
    tags: parseTags(input.tags ?? ""),
    is_shared: Boolean(input.isShared),
  };
  if (!row.title && !row.body_text && ownMedia.length === 0) return { error: "Write something, or add a photo, before saving." };

  // Row-level security limits updates to your own entries.
  const saved = input.id
    ? await supabase.from("journal_entries").update(row).eq("id", input.id).select("id").maybeSingle()
    : await supabase.from("journal_entries").insert({ ...row, owner_id: member.id }).select("id").single();
  if (saved.error || !saved.data) {
    console.error("save journal entry:", saved.error?.message);
    return { error: input.id ? "Could not save. This entry may have been deleted." : "Could not save the entry. Please try again." };
  }
  const entryId = saved.data.id as string;

  // Links: embedded media (lets teammates see them when the entry is shared) and the linked sightings.
  await supabase.from("links").delete().eq("from_entry_id", entryId);
  const links = [
    ...ownMedia.map((id) => ({ from_entry_id: entryId, to_media_id: id })),
    ...observationIds.map((id) => ({ from_entry_id: entryId, to_observation_id: id })),
  ];
  let linkFailed = false;
  if (links.length) {
    const { error } = await supabase.from("links").insert(links);
    if (error) {
      console.error("save journal links:", error.message);
      linkFailed = true;
    }
  }

  revalidatePath("/journal");
  for (const id of observationIds) revalidatePath(`/observations/${id}`);
  // The entry is saved either way; say so plainly if its links to sightings or photos were refused.
  redirect(linkFailed ? `/journal/${entryId}?links=failed` : `/journal/${entryId}`);
}

export async function deleteEntry(formData: FormData) {
  const member = await getCurrentMember();
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  const { data: entry } = await supabase.from("journal_entries").select("owner_id").eq("id", id).maybeSingle();
  // Row-level security allows this only for the entry's owner or the admin. Photos stay in the media library.
  const { error } = await supabase.from("journal_entries").delete().eq("id", id);
  if (error) console.error("delete journal entry:", error.message);
  revalidatePath("/journal");
  redirect(entry && entry.owner_id !== member.id ? "/journal?show=team&all=1" : "/journal");
}

export type UploadedMedia = { key: string; kind: "photo" | "video"; mime: string; size: number; takenAt?: string; lat?: number; lng?: number };

/** Records a photo or video uploaded from the journal editor, and returns its id and a view link. */
export async function addEntryMedia(m: UploadedMedia): Promise<{ id: string; url: string } | { error: string }> {
  const member = await getCurrentMember();
  if (typeof m?.key !== "string" || !m.key.startsWith(`${member.id}/`)) return { error: "That upload is not yours." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media")
    .insert({
      owner_id: member.id,
      file_key: m.key,
      media_type: m.kind === "video" ? "video" : "photo",
      mime_type: clip(m.mime, 100),
      size_bytes: Number(m.size) || null,
      taken_at: m.takenAt && !isNaN(+new Date(m.takenAt)) ? m.takenAt : null,
      location: okCoord(m.lat, m.lng) ? point(m.lat!, m.lng!) : null,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("save journal media:", error?.message);
    return { error: "The file uploaded but could not be saved. Please try again." };
  }
  try {
    return { id: data.id, url: await signedViewUrl(m.key) };
  } catch {
    return { error: "Storage is not set up yet." };
  }
}

/** Everyone's sightings on a given day (yours first), offered for linking to the entry. */
export async function sightingsOnDay(date: string): Promise<DaySighting[]> {
  const member = await getCurrentMember();
  const between = istDayRange(date);
  if (!between) return [];
  const list = await listObservations({ between }, 100);
  const rows = list.map((o) => toDaySighting(o, member.id));
  return [...rows.filter((s) => s.by === null), ...rows.filter((s) => s.by !== null)];
}

/**
 * Sightings from any day, yours and the team's, matching a name or place (empty search = all),
 * with the journal entry's day first and then the nearest days.
 */
export async function findSightings(q: string, entryDate: string): Promise<DaySighting[]> {
  const member = await getCurrentMember();
  const list = await searchObservations(String(q ?? ""), 20, istDayRange(String(entryDate ?? "")) ?? undefined);
  return list.map((o) => toDaySighting(o, member.id));
}

/** Links one of your entries to a sighting (from the sighting's page). */
export async function linkEntry(formData: FormData) {
  const member = await getCurrentMember();
  const entryId = String(formData.get("entryId") ?? "");
  const observationId = String(formData.get("observationId") ?? "");
  if (!UUID.test(entryId) || !UUID.test(observationId)) return;
  const supabase = await createClient();
  const { data: entry } = await supabase.from("journal_entries").select("id").eq("id", entryId).eq("owner_id", member.id).maybeSingle();
  if (!entry) return;
  const { data: existing } = await supabase
    .from("links")
    .select("id")
    .eq("from_entry_id", entryId)
    .eq("to_observation_id", observationId)
    .limit(1);
  if (!existing?.length) {
    const { error } = await supabase.from("links").insert({ from_entry_id: entryId, to_observation_id: observationId });
    if (error) {
      console.error("link entry:", error.message);
      redirect(`/observations/${observationId}?links=failed`);
    }
  }
  revalidatePath(`/observations/${observationId}`);
  revalidatePath(`/journal/${entryId}`);
  revalidatePath("/journal");
}

/** Removes the link between one of your entries and a sighting. Neither is deleted. */
export async function unlinkEntry(formData: FormData) {
  await getCurrentMember();
  const entryId = String(formData.get("entryId") ?? "");
  const observationId = String(formData.get("observationId") ?? "");
  if (!UUID.test(entryId) || !UUID.test(observationId)) return;
  const supabase = await createClient();
  // Row-level security allows this only for the entry's owner.
  const { error } = await supabase.from("links").delete().eq("from_entry_id", entryId).eq("to_observation_id", observationId);
  if (error) console.error("unlink entry:", error.message);
  revalidatePath(`/observations/${observationId}`);
  revalidatePath(`/journal/${entryId}`);
}
