// Ordering of iNaturalist species suggestions. Kept free of imports so it can be tested directly.

export type InatTaxon = {
  id: number;
  name: string;
  rank?: string;
  preferred_common_name?: string | null;
  iconic_taxon_name?: string | null;
};

/**
 * Puts the two iNaturalist lists in one order:
 *  1. a species whose common or scientific name is exactly what was typed ("tiger" → Tiger),
 *  2. species recorded in India, most-recorded first ("langur" → Bengal Sacred Langur),
 *  3. other species worldwide whose names match.
 */
export function mergeTaxa(query: string, india: InatTaxon[], worldwide: InatTaxon[], limit = 10): InatTaxon[] {
  const q = query.trim().toLowerCase();
  const isExact = (t: InatTaxon) => t.name.toLowerCase() === q || (t.preferred_common_name ?? "").toLowerCase() === q;
  const all = [...india, ...worldwide].filter((t) => t.rank === undefined || t.rank === "species");
  const ordered = [...all.filter(isExact), ...all];
  const seen = new Set<number>();
  return ordered.filter((t) => !seen.has(t.id) && seen.add(t.id)).slice(0, limit);
}
