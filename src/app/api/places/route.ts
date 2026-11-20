import { NextResponse, type NextRequest } from "next/server";
import { placeNameAt, searchPlaces } from "@/lib/places";

// GET /api/places?q=Mocha village     -> matching places
// GET /api/places?lat=22.28&lng=80.53 -> the place at those coordinates
// Signed-in members only; the proxy blocks everyone else.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  try {
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    if (params.has("lat") && Number.isFinite(lat) && Number.isFinite(lng)) {
      const place = await placeNameAt(lat, lng);
      return NextResponse.json({ results: place ? [place] : [] });
    }
    return NextResponse.json({ results: await searchPlaces(params.get("q") ?? "") });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Place search failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
