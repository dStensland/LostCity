import { NextResponse } from "next/server";
import { checkBodySize, isValidString } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getUser } from "@/lib/supabase/server";
import { attributeSignupToPortal } from "@/lib/auth-attribution";
import { isValidPortalSlug } from "@/lib/auth-utils";

export async function POST(request: Request) {
  const sizeCheck = checkBodySize(request, 2048);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.auth, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { portal_slug?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const portalSlug = body.portal_slug;
  if (!isValidString(portalSlug, 2, 80) || !isValidPortalSlug(portalSlug)) {
    return NextResponse.json({ error: "Invalid portal_slug" }, { status: 400 });
  }

  try {
    await attributeSignupToPortal(user.id, portalSlug);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to write signup attribution" }, { status: 500 });
  }
}
