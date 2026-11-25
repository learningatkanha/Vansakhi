"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, roleFrom } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/env";
import { passwordProblem, temporaryPassword } from "@/lib/passwords";

export type InviteState = { ok?: string; password?: string; error?: string };

export async function inviteMember(_prev: InviteState, formData: FormData): Promise<InviteState> {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = roleFrom(formData.get("role"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email address." };

  // The admin adds the person directly with a temporary password and passes it on;
  // they change it after signing in. No email is sent, so Supabase's email limit doesn't matter.
  const password = temporaryPassword();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) {
    console.error("add member:", error.message);
    return { error: /already|exists|registered/i.test(error.message) ? "That person is already on the team." : "Could not add them." };
  }

  if (role !== "observer") {
    await admin.from("profiles").update({ role }).eq("id", data.user.id);
  }
  revalidatePath("/admin");
  return { ok: `Added ${email}. Send them the address ${siteUrl()}/login and this temporary password:`, password };
}

export type ResetState = { password?: string; error?: string };

export async function resetPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing member." };

  const password = temporaryPassword();
  if (passwordProblem(password)) return { error: "Could not make a password." };
  const { error } = await createAdminClient().auth.admin.updateUserById(id, { password });
  if (error) {
    console.error("reset password:", error.message);
    return { error: "Could not reset the password." };
  }
  return { password };
}

export async function changeRole(formData: FormData) {
  const me = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const role = roleFrom(formData.get("role"));
  if (!id || id === me.id) return; // admins can't demote themselves, so there is always one admin

  await createAdminClient().from("profiles").update({ role }).eq("id", id);
  revalidatePath("/admin");
}

export type BlockState = { error?: string };

/**
 * Blocks or unblocks a member. Blocking bans their login (Supabase Auth) and marks them blocked, which the
 * database rules treat as "not on the team", so an open session loses access straight away too.
 * Their sightings and journal entries stay; the admin can delete any of them.
 */
export async function setBlocked(_prev: BlockState, formData: FormData): Promise<BlockState> {
  const me = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const block = formData.get("block") === "1";
  if (!id) return { error: "Missing member." };
  if (id === me.id) return { error: "You can't block yourself." };

  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.updateUserById(id, { ban_duration: block ? "876000h" : "none" });
  if (authError) {
    console.error("block member (auth):", authError.message);
    return { error: block ? "Could not block them." : "Could not unblock them." };
  }
  const { error } = await admin.from("profiles").update({ blocked_at: block ? new Date().toISOString() : null }).eq("id", id);
  if (error) {
    console.error("block member (profile):", error.message);
    return { error: "Their login was changed, but the team list could not be updated. Please try again." };
  }
  revalidatePath("/admin");
  return {};
}
