import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

// Cache the parsed GeoJSON in module scope — the file is static and large;
// parsing it once per cold start is cheaper than reading disk on every request.
let cachedGeoJson: object | null = null;

export async function GET() {
  try {
    if (!cachedGeoJson) {
      const filePath = join(
        process.cwd(),
        "data",
        "neighborhood-boundaries.json"
      );
      cachedGeoJson = JSON.parse(readFileSync(filePath, "utf-8"));
    }

    return NextResponse.json(cachedGeoJson, {
      headers: {
        "Cache-Control":
          "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("[neighborhoods/boundaries] Failed to read GeoJSON:", error);
    return NextResponse.json(
      { error: "Boundaries file unavailable" },
      { status: 500 }
    );
  }
}
