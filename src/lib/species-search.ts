/**
 * Species search for the app. Uses iNaturalist, which knows everyday names far better than GBIF
 * ("tiger", "sal", "mahua", "langur"), and puts species actually recorded in India first.
 * Each result is matched to its GBIF number, which is how the app stores species.
 * If iNaturalist can't be reached, falls back to the plain GBIF search.
 */

import { gbifKeyFor, searchGbif, type SpeciesMatch } from "./gbif";
import { mergeTaxa, type InatTaxon } from "./inat-taxa";

const INDIA = 6681; // iNaturalist place id
const DAY = 24 * 60 * 60;
const HEADERS = { Accept: "application/json", "User-Agent": "FieldJournal/1.0 (species search)" };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(5000), next: { revalidate: DAY } });
  if (!res.ok) throw new Error(`iNaturalist search failed (${res.status})`);
  return (await res.json()) as T;
}

async function searchInat(q: string): Promise<SpeciesMatch[]> {
  const enc = encodeURIComponent(q);
  const [india, worldwide] = await Promise.all([
    getJson<{ results?: { taxon: InatTaxon }[] }>(
      `https://api.inaturalist.org/v1/observations/species_counts?place_id=${INDIA}&q=${enc}&search_on=names&per_page=10&locale=en&preferred_place_id=${INDIA}`,
    ),
    getJson<{ results?: InatTaxon[] }>(
      `https://api.inaturalist.org/v1/taxa/autocomplete?q=${enc}&rank=species&is_active=true&per_page=10&locale=en&preferred_place_id=${INDIA}`,
    ),
  ]);
  const taxa = mergeTaxa(q, (india.results ?? []).map((r) => r.taxon), worldwide.results ?? []);

  // The app stores species by their GBIF number; drop the rare one GBIF doesn't know.
  const matched = await Promise.all(
    taxa.map(async (t): Promise<SpeciesMatch | null> => {
      const g = await gbifKeyFor(t.name);
      if (!g) return null;
      return { gbifKey: g.key, scientificName: t.name, commonName: t.preferred_common_name ?? null, hindiName: null, group: t.iconic_taxon_name ?? g.group };
    }),
  );
  const seen = new Set<number>();
  return matched.filter((m): m is SpeciesMatch => !!m && !seen.has(m.gbifKey) && !!seen.add(m.gbifKey));
}

export async function searchSpecies(query: string): Promise<SpeciesMatch[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const results = await searchInat(q);
    if (results.length > 0) return results;
  } catch (error) {
    console.error("species search (iNaturalist):", error);
  }
  return searchGbif(q);
}
