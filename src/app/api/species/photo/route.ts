import { NextResponse, type NextRequest } from "next/server";
import { speciesPhoto } from "@/lib/species-photos";

// GET /api/species/photo?name=Panthera%20tigris  ->  redirects to a small photo, or 404 when there is none.
// Used as an <img> src next to species suggestions (signed-in members only; the proxy blocks everyone else).
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name") ?? "";
  const url = await speciesPhoto(name);
  if (!url) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, max-age=86400" } });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, max-age=604800" } });
}
