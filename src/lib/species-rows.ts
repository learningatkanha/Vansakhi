import "server-only";
import { createClient } from "@/lib/supabase/server";
import { hindiNameFor, type SpeciesMatch } from "@/lib/gbif";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The species' row id, adding it to the species table first if it's new. */
export async function speciesRowId(supabase: Supabase, s: SpeciesMatch) {
  const { data: known } = await supabase.from("species").select("id").eq("gbif_key", s.gbifKey).maybeSingle();
  if (known) return known.id as number;
  // New to the app: look up a Hindi name once, since the search doesn't bring one.
  const hindiName = s.hindiName ?? (await hindiNameFor(s.gbifKey));
  await supabase.from("species").upsert(
    { gbif_key: s.gbifKey, scientific_name: s.scientificName, common_name: s.commonName, hindi_name: hindiName, group_name: s.group },
    { onConflict: "gbif_key", ignoreDuplicates: true },
  );
  const { data } = await supabase.from("species").select("id").eq("gbif_key", s.gbifKey).single();
  return (data?.id as number | undefined) ?? null;
}

/** A species chosen in the search box, sent as JSON in a form; null if it's missing or malformed. */
export function speciesFromForm(value: FormDataEntryValue | null): SpeciesMatch | null {
  try {
    const s = JSON.parse(String(value ?? ""));
    if (typeof s?.gbifKey !== "number" || typeof s.scientificName !== "string" || !s.scientificName) return null;
    const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);
    return { gbifKey: s.gbifKey, scientificName: s.scientificName.slice(0, 200), commonName: text(s.commonName), hindiName: text(s.hindiName), group: text(s.group) };
  } catch {
    return null;
  }
}
