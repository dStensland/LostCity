import { createClient, canManagePortal } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { invalidateDomainCache } from "@/lib/domain-cache";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/admin/portals/[id]/verify-domain
 *
 * Verifies that the portal's custom domain has the correct TXT record set up.
 * The expected TXT record is: _lostcity-verify.{domain} TXT "portal-id={verification_token}"
 */
export async function POST(request: NextRequest, { params }: Props) {
  const { id } = await params;

  // Verify admin or portal owner
  if (!(await canManagePortal(id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = await createClient();

  // Get portal with domain info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: portal, error: fetchError } = await (supabase as any)
    .from("portals")
    .select("id, custom_domain, custom_domain_verified, custom_domain_verification_token")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  if (!portal.custom_domain) {
    return NextResponse.json({ error: "No custom domain configured" }, { status: 400 });
  }

  if (portal.custom_domain_verified) {
    return NextResponse.json({
      verified: true,
      message: "Domain already verified"
    });
  }

  if (!portal.custom_domain_verification_token) {
    return NextResponse.json({ error: "No verification token found" }, { status: 400 });
  }

  // Perform DNS lookup for TXT record
  const txtHost = `_lostcity-verify.${portal.custom_domain}`;
  const expectedValue = `portal-id=${portal.custom_domain_verification_token}`;

  try {
    // Use DNS over HTTPS (DoH) with Google's public DNS
    // This works in serverless environments where dns.resolve() isn't available
    const dohUrl = `https://dns.google/resolve?name=${encodeURIComponent(txtHost)}&type=TXT`;

    const dnsResponse = await fetch(dohUrl, {
      headers: { 'Accept': 'application/dns-json' },
    });

    if (!dnsResponse.ok) {
      return NextResponse.json({
        verified: false,
        error: "DNS lookup failed",
        instructions: {
          host: txtHost,
          type: "TXT",
          value: expectedValue,
        },
      });
    }

    const dnsData = await dnsResponse.json();

    // Check if we found the expected TXT record
    let verified = false;
    const foundRecords: string[] = [];

    if (dnsData.Answer) {
      for (const answer of dnsData.Answer) {
        if (answer.type === 16) { // TXT record type
          // TXT records come with quotes, remove them
          const recordValue = answer.data?.replace(/^"|"$/g, '') || '';
          foundRecords.push(recordValue);

          if (recordValue === expectedValue) {
            verified = true;
            break;
          }
        }
      }
    }

    if (verified) {
      // Update portal as verified
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("portals")
        .update({
          custom_domain_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) {
        return NextResponse.json({
          error: "Failed to update verification status"
        }, { status: 500 });
      }

      // Invalidate domain cache so it picks up the verified status
      invalidateDomainCache(portal.custom_domain);

      return NextResponse.json({
        verified: true,
        message: "Domain verified successfully! Your custom domain is now active.",
      });
    } else {
      return NextResponse.json({
        verified: false,
        message: "TXT record not found or doesn't match",
        expected: {
          host: txtHost,
          type: "TXT",
          value: expectedValue,
        },
        found: foundRecords.length > 0 ? foundRecords : null,
        tip: "DNS changes can take up to 48 hours to propagate. Try again later if you just added the record.",
      });
    }
  } catch (error) {
    console.error("DNS verification error:", error);
    return NextResponse.json({
      verified: false,
      error: "DNS lookup failed",
      instructions: {
        host: txtHost,
        type: "TXT",
        value: expectedValue,
      },
    }, { status: 500 });
  }
}
