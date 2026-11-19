"use server";

import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";

export type SignInState = { sent: boolean; error?: string };

export async function sendSignInLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { sent: false, error: "Please enter a valid email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false, // invite-only: unknown emails never get an account
      emailRedirectTo: `${siteUrl()}/auth/callback`,
    },
  });

  if (error) {
    console.error("sign-in link:", error.message);
    if (error.status === 429) return { sent: false, error: "Too many attempts. Please wait a minute and try again." };
    if (!error.status || error.status >= 500) return { sent: false, error: "Sign-in is unavailable right now. Please try again shortly." };
  }
  // Same answer whether or not the email is on the team, so the form can't be used to probe for members.
  return { sent: true };
}
