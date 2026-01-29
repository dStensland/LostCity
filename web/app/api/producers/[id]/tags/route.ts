import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Redirect to /api/organizations/[id]/tags for backwards compatibility
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const newUrl = url.href.replace("/api/producers", "/api/organizations");
  return NextResponse.redirect(newUrl, { status: 308 });
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const newUrl = url.href.replace("/api/producers", "/api/organizations");
  return NextResponse.redirect(newUrl, { status: 308 });
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const newUrl = url.href.replace("/api/producers", "/api/organizations");
  return NextResponse.redirect(newUrl, { status: 308 });
}
