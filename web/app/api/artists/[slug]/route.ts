import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, isValidString } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getArtistExhibitions } from "@/lib/artists";

export const dynamic = "force-dynamic";

// GET /api/artists/:slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  if (!isValidString(slug, 1, 200)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    // Fetch artist profile
    const { data: artist, error } = await supabase
      .from("artists")
      .select(
        "id, name, slug, discipline, bio, image_url, website, is_verified, created_at"
      )
      .eq("slug", slug)
      .maybeSingle();

    if (error) return errorResponse(error, "GET /api/artists/:slug");
    if (!artist) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 });
    }

    const artistData = artist as {
      id: string;
      name: string;
      slug: string;
      discipline: string;
      bio: string | null;
      image_url: string | null;
      website: string | null;
      is_verified: boolean;
      created_at: string;
    };

    // Fetch exhibition history using existing function
    const exhibitions = await getArtistExhibitions(artistData.id);

    return NextResponse.json(
      {
        artist: {
          ...artistData,
          exhibitions,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    return errorResponse(error, "GET /api/artists/:slug");
  }
}
