import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getCachedPortalBySlug } from "@/lib/portal";
import { getHospitalLandingData, getHospitalWayfindingPayload } from "@/lib/hospitals";
import { normalizeHospitalMode } from "@/lib/hospital-modes";

type Props = {
  params: Promise<{ slug: string; hospital: string }>;
};

export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug, hospital } = await params;
  const mode = normalizeHospitalMode(request.nextUrl.searchParams.get("mode"));
  const includeWayfinding = request.nextUrl.searchParams.get("include") === "wayfinding";
  const portal = await getCachedPortalBySlug(slug);

  if (!portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const data = await getHospitalLandingData(portal.id, hospital, mode);
  if (!data) {
    return NextResponse.json({ error: "Hospital landing page not found" }, { status: 404 });
  }

  const responseBody: Record<string, unknown> = {
    portal: {
      id: portal.id,
      slug: portal.slug,
      name: portal.name,
    },
    mode,
    ...data,
  };

  if (includeWayfinding) {
    responseBody.wayfinding = getHospitalWayfindingPayload({
      hospital: data.hospital,
      nearby: data.nearby,
      mode,
    });
  }

  return NextResponse.json(responseBody);
}
