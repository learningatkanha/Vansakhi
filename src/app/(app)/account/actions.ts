"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/lib/auth";
import { passwordProblem } from "@/lib/passwords";

export type ChangePasswordState = { ok?: boolean; error?: string };

export async function changePassword(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  await getCurrentMember();
  const password = String(formData.get("password") ?? "");
  const problem = passwordProblem(password, String(formData.get("confirm") ?? ""));
  if (problem) return { error: problem };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("change password:", error.message);
    if (/different from the old/i.test(error.message)) return { error: "Choose a password different from your current one." };
    if (/weak|pwned|known/i.test(error.message)) return { error: "That password is too easy to guess. Try a longer one." };
    return { error: "Could not change your password. Please try again." };
  }
  return { ok: true };
}
