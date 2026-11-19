"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/env";

export type InviteState = { ok?: string; error?: string };

export async function inviteMember(_prev: InviteState, formData: FormData): Promise<InviteState> {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = formData.get("role") === "admin" ? "admin" : "researcher";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email address." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { name },
    redirectTo: `${siteUrl()}/auth/confirm`,
  });
  if (error) {
    console.error("invite:", error.message);
    return { error: error.message.includes("already") ? "That person is already on the team." : "Could not send the invite." };
  }

  if (role === "admin") {
    await admin.from("profiles").update({ role }).eq("id", data.user.id);
  }
  revalidatePath("/admin");
  return { ok: `Invite sent to ${email}.` };
}

export async function changeRole(formData: FormData) {
  const me = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const role = formData.get("role") === "admin" ? "admin" : "researcher";
  if (!id || id === me.id) return; // admins can't demote themselves, so there is always one admin

  await createAdminClient().from("profiles").update({ role }).eq("id", id);
  revalidatePath("/admin");
}
