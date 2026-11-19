import "server-only";

/** Which outside services are configured. Used by the setup checklist on the Admin page. */
export function serviceStatus() {
  const has = (...names: string[]) => names.every((n) => Boolean(process.env[n]));
  return [
    {
      name: "Supabase (database and login)",
      ok: has("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"),
    },
    {
      name: "Cloudflare R2 (photo and video storage)",
      ok: has("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"),
    },
    { name: "Google Maps (place search)", ok: has("GOOGLE_MAPS_API_KEY") },
    { name: "Claude Haiku (species ID, phase 5)", ok: has("ANTHROPIC_API_KEY") },
  ];
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
