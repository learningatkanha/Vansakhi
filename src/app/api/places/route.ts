import { NextResponse, type NextRequest } from "next/server";
import { searchPlaces } from "@/lib/places";

// GET /api/places?q=Mocha village  (signed-in members only; the proxy blocks everyone else)
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  try {
    return NextResponse.json({ results: await searchPlaces(q) });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Place search failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
