import { NextResponse, type NextRequest } from "next/server";
import { searchSpecies } from "@/lib/species-search";

// GET /api/species?q=barasingha  (signed-in members only; the proxy blocks everyone else)
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  try {
    return NextResponse.json({ results: await searchSpecies(q) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Species search is unavailable right now." }, { status: 502 });
  }
}
