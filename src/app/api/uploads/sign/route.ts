import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MAX_UPLOAD_BYTES, mediaTypeFor, signedUploadUrl } from "@/lib/r2";

// POST /api/uploads/sign  { contentType, size }  ->  { key, url, mediaType }
// Hands out a 10-minute link so the browser can upload one file straight to R2.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { contentType?: string; size?: number } | null;
  const contentType = body?.contentType ?? "";
  const size = Number(body?.size ?? 0);

  const mediaType = mediaTypeFor(contentType);
  if (!mediaType) return NextResponse.json({ error: "That file type is not supported." }, { status: 400 });
  if (!(size > 0) || size > MAX_UPLOAD_BYTES)
    return NextResponse.json({ error: "Files must be under 100 MB." }, { status: 400 });

  const ext = contentType.split("/")[1].replace("quicktime", "mov").replace("mpeg", "mp3");
  const month = new Date().toISOString().slice(0, 7);
  const key = `${userId}/${month}/${crypto.randomUUID()}.${ext}`;

  try {
    return NextResponse.json({ key, url: await signedUploadUrl(key, contentType), mediaType });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Storage is not set up yet." }, { status: 503 });
  }
}
