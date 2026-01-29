import { NextRequest, NextResponse } from "next/server";

// Redirect to /api/organizations/by-slug/[slug] for backwards compatibility
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const newUrl = url.href.replace("/api/producers", "/api/organizations");
  return NextResponse.redirect(newUrl, { status: 308 }); // Permanent redirect
}
