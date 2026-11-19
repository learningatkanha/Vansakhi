"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/env";
import { passwordProblem, temporaryPassword } from "@/lib/passwords";

export type InviteState = { ok?: string; password?: string; error?: string };

export async function inviteMember(_prev: InviteState, formData: FormData): Promise<InviteState> {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = formData.get("role") === "admin" ? "admin" : "researcher";
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

  if (role === "admin") {
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
  const role = formData.get("role") === "admin" ? "admin" : "researcher";
  if (!id || id === me.id) return; // admins can't demote themselves, so there is always one admin

  await createAdminClient().from("profiles").update({ role }).eq("id", id);
  revalidatePath("/admin");
}
