"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function deleteObservation(formData: FormData) {
  await getCurrentMember();
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  // Row-level security allows this only for the observer (or an admin).
  const { error } = await supabase.from("observations").delete().eq("id", id);
  if (error) console.error("delete observation:", error.message);
  revalidatePath("/");
  redirect("/");
}
