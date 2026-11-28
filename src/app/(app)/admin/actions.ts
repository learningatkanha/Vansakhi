"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, roleFrom } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/env";
import { passwordProblem, temporaryPassword } from "@/lib/passwords";

export type InviteState = { ok?: string; password?: string; error?: string; emailed?: boolean };

export async function inviteMember(_prev: InviteState, formData: FormData): Promise<InviteState> {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = roleFrom(formData.get("role"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email address." };
  const sendEmail = formData.get("sendEmail") === "on";
  // Without a name they'd be asked for one first and could miss choosing a password.
  if (sendEmail && !name) return { error: "Please add their name, so the invitation can greet them." };
  const admin = createAdminClient();

  // Someone added before who has never signed in (e.g. their invitation email failed) can be added again.
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).is("removed_at", null).maybeSingle();
  if (existing) {
    const { data: u } = await admin.auth.admin.getUserById(existing.id);
    if (u.user?.last_sign_in_at) return { error: "That person is already on the team." };
  }

  let userId: string;
  let password: string | undefined;
  if (sendEmail) {
    // Supabase emails them a link (sent through the Gmail account set up in Supabase -> SMTP).
    // The link opens /auth/confirm, which signs them in and asks them to choose a password.
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { name } });
    if (error) {
      console.error("invite member:", error.message);
      return {
        error:
          "Could not send the invitation email. Check the email settings in Supabase, or untick \"Email them an invitation\" to get a temporary password instead.",
      };
    }
    userId = data.user.id;
  } else {
    // The admin passes on a temporary password; they change it after signing in.
    password = temporaryPassword();
    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
      if (error) {
        console.error("re-add member:", error.message);
        return { error: "Could not add them." };
      }
      userId = existing.id;
    } else {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
      if (error) {
        console.error("add member:", error.message);
        return { error: /already|exists|registered/i.test(error.message) ? "That person is already on the team." : "Could not add them." };
      }
      userId = data.user.id;
    }
  }

  const { error: roleError } = await admin.from("profiles").update({ role, ...(name ? { name } : {}) }).eq("id", userId);
  revalidatePath("/admin");
  if (roleError) {
    console.error("set role:", roleError.message);
    const added = sendEmail ? `Invitation sent to ${email}, but` : `Added ${email}, but`;
    return {
      error: `${added} their role could not be set to ${role} (has database update 0008 been run in Supabase?). Change it in the team list once it has.`,
      ...(password ? { password } : {}),
    };
  }
  if (sendEmail) return { ok: `Invitation sent to ${email}. They'll get an email with a link to choose their password.`, emailed: true };
  return { ok: `Added ${email}. Send them the address ${siteUrl()}/login and this temporary password:`, password };
}

export type ResetState = { password?: string; error?: string };

export async function resetPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing member." };

  const password = temporaryPassword();
  if (passwordProblem(password)) return { error: "Could not make a password." };
  // Also confirm their email: someone invited by email who never clicked the link can't sign in otherwise.
  const { error } = await createAdminClient().auth.admin.updateUserById(id, { password, email_confirm: true });
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

  const { error } = await createAdminClient().from("profiles").update({ role }).eq("id", id);
  if (error) console.error("change role:", error.message, "(has database update 0008 been run?)");
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

export type RemoveState = { error?: string };

/**
 * Removes a member for good: their login is deleted (they can never sign in again and their email can be
 * invited afresh), but their profile stays, renamed "Name (former member)", so all their work stays.
 * Needs database update 0010 (before it, deleting a login deleted everything they added).
 */
export async function removeMember(_prev: RemoveState, formData: FormData): Promise<RemoveState> {
  const me = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing member." };
  if (id === me.id) return { error: "You can't remove yourself." };

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("name, email, removed_at").eq("id", id).maybeSingle();
  if (!profile || profile.removed_at) return { error: "That person is not on the team." };

  // Keep the profile (and so their work) but mark it, and free their email for a fresh invitation later.
  const label = `${profile.name?.trim() || profile.email.split("@")[0]} (former member)`;
  const { error: profileError } = await admin
    .from("profiles")
    .update({ name: label, email: `removed-${id}@former.member`, removed_at: new Date().toISOString(), blocked_at: new Date().toISOString() })
    .eq("id", id);
  if (profileError) {
    console.error("remove member (profile):", profileError.message);
    return { error: "Could not remove them. Has database update 0010 been run in Supabase?" };
  }
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    console.error("remove member (login):", error.message);
    return { error: "They are blocked and marked as a former member, but their login could not be deleted. Please try again." };
  }
  revalidatePath("/admin");
  return {};
}
