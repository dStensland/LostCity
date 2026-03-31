import { NextResponse } from "next/server";
import { getServerFindData } from "@/lib/find-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const data = await getServerFindData(slug);
  if (!data) {
    return NextResponse.json({ error: "Failed to load find data" }, { status: 500 });
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
