/**
 * A small real photo for a species, shown next to species suggestions.
 * Looks in iNaturalist first (naturalists' photos), then Wikipedia. Both are free and need no key.
 */

const WEEK = 7 * 24 * 60 * 60;
const HEADERS = { Accept: "application/json", "User-Agent": "FieldJournal/1.0 (species thumbnails)" };

type InatTaxa = { results?: { name?: string; rank?: string; default_photo?: { square_url?: string | null; medium_url?: string | null } | null }[] };
type WikiSummary = { type?: string; thumbnail?: { source?: string } };

const isHttps = (u: unknown): u is string => typeof u === "string" && u.startsWith("https://");

/** The photo of the taxon whose name matches exactly (not a look-alike). Exported for tests. */
export function pickInatPhoto(body: InatTaxa, scientificName: string): string | null {
  const name = scientificName.trim().toLowerCase();
  const taxon = (body.results ?? []).find((r) => r.name?.toLowerCase() === name);
  const photo = taxon?.default_photo;
  // "medium" is ~500 px; the square is only 75 px and looks blurry on phone screens.
  const url = photo?.medium_url ?? photo?.square_url;
  return isHttps(url) ? url : null;
}

/** The thumbnail of a normal Wikipedia article (not a disambiguation page). Exported for tests. */
export function pickWikiPhoto(body: WikiSummary): string | null {
  if (body.type && body.type !== "standard") return null;
  return isHttps(body.thumbnail?.source) ? body.thumbnail!.source! : null;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(4000), next: { revalidate: WEEK } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

// Remembered while the server is running, so repeated suggestions don't ask again.
const memory = new Map<string, string | null>();

export async function speciesPhoto(scientificName: string): Promise<string | null> {
  const name = scientificName.trim().replace(/\s+/g, " ");
  if (!/^[A-Za-z][A-Za-z .×-]{1,120}$/.test(name)) return null;
  const cacheKey = name.toLowerCase();
  if (memory.has(cacheKey)) return memory.get(cacheKey)!;

  const inat = await getJson<InatTaxa>(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(name)}&per_page=10`);
  let url = inat ? pickInatPhoto(inat, name) : null;
  if (!url) {
    const wiki = await getJson<WikiSummary>(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, "_"))}`);
    url = wiki ? pickWikiPhoto(wiki) : null;
  }

  if (memory.size > 5000) memory.clear();
  memory.set(cacheKey, url);
  return url;
}
