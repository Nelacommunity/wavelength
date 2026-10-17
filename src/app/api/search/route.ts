import { NextResponse, type NextRequest } from "next/server";
import { searchLocalSongs } from "@/lib/data/songs";
import { allow } from "@/lib/rate-limit";

/** Song search for the share composer — music uploaded on Wavelength only. */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ tracks: [] });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allow(`search:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many searches. Slow down for a moment." }, { status: 429 });
  }
  try {
    const tracks = await searchLocalSongs(q, null, 20);
    return NextResponse.json({ tracks }, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch {
    return NextResponse.json({ error: "Search is unavailable right now." }, { status: 502 });
  }
}
