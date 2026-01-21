import { NextResponse } from "next/server";
import { getAvailableFilters } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const filters = await getAvailableFilters();
    return NextResponse.json(filters);
  } catch (error) {
    console.error("Error fetching available filters:", error);
    return NextResponse.json(
      { error: "Failed to fetch filters" },
      { status: 500 }
    );
  }
}
