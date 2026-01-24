import { NextRequest, NextResponse } from "next/server";
import { getOpenSpots } from "@/lib/spots";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const types = searchParams.get("types")?.split(",").filter(Boolean);
  const neighborhood = searchParams.get("neighborhood") || undefined;
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  try {
    const spots = await getOpenSpots(types, neighborhood, limit);

    return NextResponse.json({
      spots,
      count: spots.length,
    });
  } catch (error) {
    console.error("Error fetching open spots:", error);
    return NextResponse.json(
      { error: "Failed to fetch open spots" },
      { status: 500 }
    );
  }
}
