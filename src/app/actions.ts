"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/lib/auth";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type NameState = { error?: string };

export async function saveName(_prev: NameState, formData: FormData): Promise<NameState> {
  const member = await getCurrentMember();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 60) return { error: "Please enter a name between 2 and 60 characters." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ name }).eq("id", member.id);
  if (error) return { error: "Could not save your name. Please try again." };

  revalidatePath("/", "layout");
  redirect("/");
}
