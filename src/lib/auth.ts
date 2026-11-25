import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const ROLES = ["observer", "researcher", "admin"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABEL: Record<Role, string> = { observer: "Observer", researcher: "Researcher", admin: "Admin" };

/** A role from a form, defaulting to observer for anything unexpected. */
export function roleFrom(value: unknown): Role {
  return ROLES.includes(value as Role) ? (value as Role) : "observer";
}

export type Member = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
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
  // No readable profile = not on the team any more (blocked by an admin).
  if (!profile) redirect("/login?error=blocked");

  return profile as Member;
});

/** Like getCurrentMember, but only lets admins through. */
export async function requireAdmin(): Promise<Member> {
  const member = await getCurrentMember();
  if (member.role !== "admin") redirect("/");
  return member;
}
