import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getCachedPortalBySlug } from "@/lib/portal";
import { getPortalHospitalLocations } from "@/lib/hospitals";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  const portal = await getCachedPortalBySlug(slug);

  if (!portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const hospitals = await getPortalHospitalLocations(portal.id);

  return NextResponse.json({
    portal: {
      id: portal.id,
      slug: portal.slug,
      name: portal.name,
    },
    hospitals,
  });
}
