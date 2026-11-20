import "server-only";

/** Place search with the Google Geocoding API: a typed place name becomes an address and coordinates. */

export type PlaceMatch = {
  name: string;
  lat: number;
  lng: number;
};

type GeocodeResponse = {
  status: string;
  error_message?: string;
  results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[];
};

/** Turns a raw Geocoding API response into place matches. Exported for tests. */
export function toPlaceMatches(body: GeocodeResponse): PlaceMatch[] {
  if (body.status === "ZERO_RESULTS") return [];
  if (body.status !== "OK") throw new Error(body.error_message ?? `Google Maps error: ${body.status}`);
  return (body.results ?? []).slice(0, 5).map((r) => ({
    name: r.formatted_address,
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
  }));
}

export async function searchPlaces(query: string): Promise<PlaceMatch[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("Google Maps is not set up yet (GOOGLE_MAPS_API_KEY is missing).");
  const q = query.trim();
  if (q.length < 2) return [];

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", q);
  url.searchParams.set("region", "in"); // prefer places in India, but allow anywhere
  url.searchParams.set("key", key);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Maps request failed (${res.status})`);
  return toPlaceMatches((await res.json()) as GeocodeResponse);
}

/** Coordinates (e.g. from a photo's GPS data) to the nearest place name. */
export async function placeNameAt(lat: number, lng: number): Promise<PlaceMatch | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("Google Maps is not set up yet (GOOGLE_MAPS_API_KEY is missing).");
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("key", key);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Maps request failed (${res.status})`);
  const first = toPlaceMatches((await res.json()) as GeocodeResponse)[0];
  // Keep the photo's exact coordinates; use Google only for the name.
  return first ? { name: first.name, lat, lng } : null;
}
