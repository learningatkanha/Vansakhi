"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isKind, isWritten, type CreationKind } from "@/lib/creation-kinds";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CreationMediaInput = {
  mediaId?: string; // already saved (when editing)
  key?: string; // new upload
  kind: "photo" | "video" | "audio";
  mime?: string;
  size?: number;
};

export type CreationInput = {
  id?: string;
  kind: CreationKind;
  title: string;
  textBody: string;
  movedNote: string;
  linkUrl: string;
  media: CreationMediaInput[];
  sightingIds: string[];
};

export type CreationSaveState = { error?: string };

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

export async function saveCreation(_prev: CreationSaveState, formData: FormData): Promise<CreationSaveState> {
  const member = await getCurrentMember();
  let input: CreationInput;
  try {
    input = JSON.parse(String(formData.get("input") ?? ""));
  } catch {
    return { error: "Something went wrong reading the form. Please try again." };
  }
  if (!isKind(input?.kind)) return { error: "Choose what kind of creation this is." };
  const title = clip(input.title, 200);
  if (!title) return { error: "Give your creation a title." };
  const textBody = typeof input.textBody === "string" ? input.textBody.replace(/\r\n/g, "\n").slice(0, 100000).trimEnd() : "";
  const movedNote = clip(input.movedNote, 1000);
  const linkUrl = clip(input.linkUrl, 2000);
  if (linkUrl && !/^https?:\/\/\S+$/i.test(linkUrl)) return { error: "The link should start with https://" };
  const media = (Array.isArray(input.media) ? input.media : []).slice(0, 20);
  const sightingIds = [...new Set((Array.isArray(input.sightingIds) ? input.sightingIds : []).filter((s) => UUID.test(s)))].slice(0, 12);

  const photos = media.filter((m) => m.kind === "photo").length;
  const audio = media.filter((m) => m.kind === "audio").length;
  if (isWritten(input.kind) && !textBody.trim()) return { error: "Write your piece in the box before posting." };
  if (input.kind === "painting" && photos === 0) return { error: "Add at least one photo of your artwork." };
  if ((input.kind === "audio_story" || input.kind === "audio_poem") && audio === 0)
    return { error: "Record or upload your audio before posting." };
  if (input.kind === "other" && media.length === 0 && !linkUrl && !textBody.trim())
    return { error: "Add a photo, a recording, some text or a link." };
  for (const m of media) {
    if (m.mediaId ? !UUID.test(m.mediaId) : typeof m.key !== "string" || !m.key.startsWith(`${member.id}/`))
      return { error: "One of the files isn't yours. Please remove it and add it again." };
  }

  const supabase = await createClient();
  const row = {
    kind: input.kind,
    title,
    text_body: textBody || null,
    moved_note: movedNote || null,
    link_url: linkUrl || null,
    updated_at: new Date().toISOString(),
  };

  let id = input.id && UUID.test(input.id) ? input.id : null;
  if (id) {
    const { data, error } = await supabase.from("creations").update(row).eq("id", id).eq("author_id", member.id).select("id").maybeSingle();
    if (error || !data) {
      console.error("update creation:", error?.message ?? "not yours");
      return { error: "Could not save. Only the author can edit a creation." };
    }
  } else {
    const { data, error } = await supabase.from("creations").insert({ ...row, author_id: member.id }).select("id").single();
    if (error || !data) {
      console.error("add creation:", error?.message);
      return { error: "Could not post your creation. Has database update 0012 been run in Supabase?" };
    }
    id = data.id as string;
  }

  // New uploads get a media row each; files already on the creation keep theirs.
  const fresh = media.filter((m) => !m.mediaId && m.key);
  const idByKey = new Map<string, string>();
  if (fresh.length) {
    const { data: rows, error } = await supabase
      .from("media")
      .insert(fresh.map((m) => ({ owner_id: member.id, file_key: m.key!, media_type: m.kind, mime_type: clip(m.mime, 100) || null, size_bytes: Number(m.size) || null })))
      .select("id, file_key");
    if (error || !rows) {
      console.error("creation media:", error?.message);
      return { error: "Your creation was saved, but its files could not be attached. Please edit it and add them again." };
    }
    for (const r of rows) idByKey.set(r.file_key, r.id);
  }
  await supabase.from("creation_media").delete().eq("creation_id", id);
  const mediaRows = media.flatMap((m, i) => {
    const mediaId = m.mediaId ?? (m.key ? idByKey.get(m.key) : undefined);
    return mediaId ? [{ creation_id: id!, media_id: mediaId, position: i }] : [];
  });
  if (mediaRows.length) {
    const { error } = await supabase.from("creation_media").insert(mediaRows);
    if (error) console.error("attach creation media:", error.message);
  }

  await supabase.from("creation_links").delete().eq("creation_id", id);
  if (sightingIds.length) {
    const { error } = await supabase.from("creation_links").insert(sightingIds.map((s) => ({ creation_id: id!, observation_id: s })));
    if (error) console.error("link creation:", error.message);
  }

  revalidatePath("/adda");
  for (const s of sightingIds) revalidatePath(`/observations/${s}`);
  redirect(`/adda/${id}`);
}

/** The author deletes their creation, or the admin deletes anyone's. Its files stay in the media library. */
export async function deleteCreation(formData: FormData) {
  await getCurrentMember();
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("creations").delete().eq("id", id);
  if (error) console.error("delete creation:", error.message);
  revalidatePath("/adda");
  redirect("/adda");
}

/** "This moved me": tap to add, tap again to take it back. */
export async function toggleMoved(formData: FormData) {
  const member = await getCurrentMember();
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  const { data: mine } = await supabase
    .from("creation_reactions")
    .select("creation_id")
    .eq("creation_id", id)
    .eq("member_id", member.id)
    .maybeSingle();
  const { error } = mine
    ? await supabase.from("creation_reactions").delete().eq("creation_id", id).eq("member_id", member.id)
    : await supabase.from("creation_reactions").insert({ creation_id: id, member_id: member.id });
  if (error) console.error("this moved me:", error.message);
  revalidatePath(`/adda/${id}`);
  revalidatePath("/adda");
}
