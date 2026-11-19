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

  // Free Supabase plans can't customise invite emails, so instead of sending an invite we add the
  // person directly; they sign in from the login page with an emailed link.
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
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
  return { ok: `Added ${email}. Ask them to sign in at ${siteUrl()}/login with this email.` };
}

export async function changeRole(formData: FormData) {
  const me = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const role = formData.get("role") === "admin" ? "admin" : "researcher";
  if (!id || id === me.id) return; // admins can't demote themselves, so there is always one admin

  await createAdminClient().from("profiles").update({ role }).eq("id", id);
  revalidatePath("/admin");
}
