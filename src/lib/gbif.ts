/** Species search against GBIF, the free worldwide species database (https://www.gbif.org). */

const GBIF_BACKBONE = "d7dddbf4-2cf0-4f39-9b2a-bb099caae36c";

export type SpeciesMatch = {
  gbifKey: number;
  scientificName: string;
  commonName: string | null;
  hindiName: string | null;
  group: string | null;
};

type GbifVernacular = { vernacularName?: string; language?: string };
type GbifResult = {
  key?: number;
  nubKey?: number;
  canonicalName?: string;
  scientificName?: string;
  kingdom?: string;
  class?: string;
  vernacularNames?: GbifVernacular[];
};

function pickName(names: GbifVernacular[], languages: string[]) {
  const found = names.find((n) => n.vernacularName && languages.includes((n.language ?? "").toLowerCase()));
  return found?.vernacularName ?? null;
}

/** Turns one raw GBIF search result into the shape the app uses. Exported for tests. */
export function toSpeciesMatch(r: GbifResult): SpeciesMatch | null {
  const gbifKey = r.nubKey ?? r.key;
  const scientificName = r.canonicalName ?? r.scientificName;
  if (!gbifKey || !scientificName) return null;
  const names = r.vernacularNames ?? [];
  return {
    gbifKey,
    scientificName,
    commonName: pickName(names, ["eng", "en"]),
    hindiName: pickName(names, ["hin", "hi"]),
    group: r.class ?? r.kingdom ?? null,
  };
}

const DAY = 24 * 60 * 60;

async function gbifJson<T>(url: string | URL): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000), next: { revalidate: DAY } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** GBIF's number for a scientific name (the accepted one, if the name is an older synonym). */
export async function gbifKeyFor(scientificName: string): Promise<{ key: number; group: string | null } | null> {
  const url = new URL("https://api.gbif.org/v1/species/match");
  url.searchParams.set("name", scientificName);
  url.searchParams.set("rank", "SPECIES");
  url.searchParams.set("strict", "true");
  const m = await gbifJson<{ matchType?: string; usageKey?: number; acceptedUsageKey?: number; class?: string; kingdom?: string }>(url);
  const key = m?.acceptedUsageKey ?? m?.usageKey;
  if (!m || m.matchType === "NONE" || !key) return null;
  return { key, group: m.class ?? m.kingdom ?? null };
}

/** A Hindi name for the species from GBIF, preferring one written in Devanagari. Exported for tests. */
export function pickHindi(names: GbifVernacular[]): string | null {
  const hindi = names.filter((n) => n.vernacularName && ["hin", "hi"].includes((n.language ?? "").toLowerCase())).map((n) => n.vernacularName!);
  return hindi.find((n) => /[ऀ-ॿ]/.test(n)) ?? hindi[0] ?? null;
}

export async function hindiNameFor(gbifKey: number): Promise<string | null> {
  const body = await gbifJson<{ results?: GbifVernacular[] }>(`https://api.gbif.org/v1/species/${gbifKey}/vernacularNames?limit=200`);
  return pickHindi(body?.results ?? []);
}

/** The plain GBIF text search (used only if iNaturalist can't be reached). */
export async function searchGbif(query: string, limit = 10): Promise<SpeciesMatch[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = new URL("https://api.gbif.org/v1/species/search");
  url.searchParams.set("q", q);
  url.searchParams.set("datasetKey", GBIF_BACKBONE);
  url.searchParams.set("rank", "SPECIES");
  url.searchParams.set("status", "ACCEPTED");
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`GBIF search failed (${res.status})`);
  const body = (await res.json()) as { results?: GbifResult[] };

  const seen = new Set<number>();
  const matches: SpeciesMatch[] = [];
  for (const r of body.results ?? []) {
    const m = toSpeciesMatch(r);
    if (m && !seen.has(m.gbifKey)) {
      seen.add(m.gbifKey);
      matches.push(m);
    }
  }
  return matches;
}
