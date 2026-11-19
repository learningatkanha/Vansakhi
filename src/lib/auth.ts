import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Member = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "researcher";
};

/** The signed-in member, read once per request. Sends signed-out visitors to /login. */
export const getCurrentMember = cache(async (): Promise<Member> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, name, role")
    .eq("id", userId)
    .single();
  if (!profile) redirect("/login");

  return profile as Member;
});

/** Like getCurrentMember, but only lets admins through. */
export async function requireAdmin(): Promise<Member> {
  const member = await getCurrentMember();
  if (member.role !== "admin") redirect("/");
  return member;
}
