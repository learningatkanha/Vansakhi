"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PasswordState = { error?: string };

export async function signInWithPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!EMAIL.test(email) || !password) return { error: "Please enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("password sign-in:", error.message);
    if (error.status === 429) return { error: "Too many attempts. Please wait a minute and try again." };
    if (error.code === "user_banned") return { error: "This account has been blocked. Please speak to the admin." };
    if (error.status === 400) return { error: "That email and password don't match." };
    return { error: "Sign-in is unavailable right now. Please try again shortly." };
  }
  redirect("/");
}

export type SignInState = { sent: boolean; error?: string };

export async function sendSignInLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { sent: false, error: "Please enter a valid email address." };

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
    if (error.status === 429)
      return { sent: false, error: "Our email limit is used up for now. Sign in with your password, or try again in an hour." };
    if (!error.status || error.status >= 500) return { sent: false, error: "Sign-in is unavailable right now. Please try again shortly." };
  }
  // Same answer whether or not the email is on the team, so the form can't be used to probe for members.
  return { sent: true };
}
