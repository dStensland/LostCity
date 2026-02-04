import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// Validate URL is safe for external fetching (prevents SSRF)
function isValidExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow HTTPS
    if (parsed.protocol !== "https:") return false;
    // Reject localhost and common internal hostnames
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname === "metadata.google.internal" ||
      hostname === "169.254.169.254"
    ) return false;
    // Reject private IP ranges
    const parts = hostname.split(".");
    if (parts.length === 4 && parts.every(p => /^\d+$/.test(p))) {
      const first = parseInt(parts[0]);
      const second = parseInt(parts[1]);
      if (first === 10) return false; // 10.0.0.0/8
      if (first === 172 && second >= 16 && second <= 31) return false; // 172.16.0.0/12
      if (first === 192 && second === 168) return false; // 192.168.0.0/16
      if (first === 169 && second === 254) return false; // 169.254.0.0/16
      if (first === 127) return false; // 127.0.0.0/8
    }
    return true;
  } catch {
    return false;
  }
}

// Lazy initialization to avoid build errors when env vars not present
let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error("Missing Supabase configuration for admin operations");
    }

    _supabaseAdmin = createClient(url, key);
  }
  return _supabaseAdmin;
}

type LogoResult = {
  id: string;
  name: string;
  status: "success" | "failed" | "skipped";
  logo_url?: string;
  error?: string;
};

// Try to extract logo URL from website
async function fetchLogoFromWebsite(websiteUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LostCityBot/1.0)",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();
    const baseUrl = new URL(websiteUrl).origin;

    // Try different logo sources in order of preference
    const patterns = [
      // Apple touch icon (usually high quality)
      /<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i,
      /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']apple-touch-icon["']/i,
      // Open Graph image
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
      // Twitter image
      /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
      // Large favicon
      /<link[^>]*rel=["']icon["'][^>]*sizes=["'](?:192|180|152|144|120|96)[^"']*["'][^>]*href=["']([^"']+)["']/i,
      // Any favicon with type
      /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        let logoUrl = match[1];
        // Convert relative URLs to absolute
        if (logoUrl.startsWith("/")) {
          logoUrl = baseUrl + logoUrl;
        } else if (!logoUrl.startsWith("http")) {
          logoUrl = baseUrl + "/" + logoUrl;
        }
        return logoUrl;
      }
    }

    // Fallback: try standard favicon.ico
    const faviconUrl = `${baseUrl}/favicon.ico`;
    try {
      const faviconRes = await fetch(faviconUrl, { method: "HEAD" });
      if (faviconRes.ok) {
        return faviconUrl;
      }
    } catch {
      // Ignore favicon fetch errors
    }

    return null;
  } catch (error) {
    logger.error(`Error fetching website ${websiteUrl}:`, error);
    return null;
  }
}

// Try to get Instagram profile pic
async function fetchInstagramAvatar(instagramHandle: string): Promise<string | null> {
  try {
    // Clean the handle
    const handle = instagramHandle.replace(/^@/, "").replace(/\/$/, "");

    // Instagram's profile pic endpoint (may require auth or have rate limits)
    // Using a public approach via the web page
    const profileUrl = `https://www.instagram.com/${handle}/`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(profileUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();

    // Try to find og:image which is usually the profile pic
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (ogMatch?.[1]) {
      return ogMatch[1];
    }

    return null;
  } catch (error) {
    logger.error(`Error fetching Instagram ${instagramHandle}:`, error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  // Apply rate limiting (standard tier - admin endpoint)
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.standard, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  // Verify admin
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { organizationIds, overwrite = false } = body as {
      organizationIds?: string[];
      overwrite?: boolean;
    };

    const supabase = getSupabaseAdmin();

    // Fetch organizations to update
    let query = supabase
      .from("organizations")
      .select("id, name, website, instagram, logo_url")
      .eq("hidden", false);

    if (organizationIds && organizationIds.length > 0) {
      query = query.in("id", organizationIds);
    }

    if (!overwrite) {
      query = query.is("logo_url", null);
    }

    const { data: organizations, error } = await query;

    if (error) {
      logger.error("Error fetching organizations:", error);
      return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
    }

    if (!organizations || organizations.length === 0) {
      return NextResponse.json({
        message: "No organizations to update",
        results: []
      });
    }

    const results: LogoResult[] = [];

    for (const organization of organizations) {
      // Skip if already has logo and not overwriting
      if (organization.logo_url && !overwrite) {
        results.push({
          id: organization.id,
          name: organization.name,
          status: "skipped",
        });
        continue;
      }

      let logoUrl: string | null = null;

      // Try website first
      if (organization.website) {
        // Validate URL is safe before fetching
        if (isValidExternalUrl(organization.website)) {
          logoUrl = await fetchLogoFromWebsite(organization.website);
        } else {
          results.push({
            id: organization.id,
            name: organization.name,
            status: "failed",
            error: "Invalid or unsafe website URL",
          });
          continue;
        }
      }

      // Fall back to Instagram
      if (!logoUrl && organization.instagram) {
        logoUrl = await fetchInstagramAvatar(organization.instagram);
      }

      if (logoUrl) {
        // Update the database
        const { error: updateError } = await supabase
          .from("organizations")
          .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
          .eq("id", organization.id);

        if (updateError) {
          results.push({
            id: organization.id,
            name: organization.name,
            status: "failed",
            error: updateError.message,
          });
        } else {
          results.push({
            id: organization.id,
            name: organization.name,
            status: "success",
            logo_url: logoUrl,
          });
        }
      } else {
        results.push({
          id: organization.id,
          name: organization.name,
          status: "failed",
          error: "No logo found from website or Instagram",
        });
      }
    }

    const successCount = results.filter(r => r.status === "success").length;
    const failedCount = results.filter(r => r.status === "failed").length;
    const skippedCount = results.filter(r => r.status === "skipped").length;

    return NextResponse.json({
      message: `Processed ${results.length} organizations: ${successCount} success, ${failedCount} failed, ${skippedCount} skipped`,
      results,
      summary: { success: successCount, failed: failedCount, skipped: skippedCount },
    });
  } catch (err) {
    logger.error("Error in fetch-logos API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET endpoint to check organizations without logos
export async function GET(request: NextRequest) {
  // Apply rate limiting (standard tier - admin endpoint)
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.standard, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  // Verify admin
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: organizations, error } = await supabase
      .from("organizations")
      .select("id, name, website, instagram, logo_url")
      .eq("hidden", false)
      .is("logo_url", null)
      .order("name");

    if (error) {
      return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
    }

    const withWebsite = organizations?.filter(p => p.website) || [];
    const withInstagram = organizations?.filter(p => p.instagram) || [];
    const canFetch = organizations?.filter(p => p.website || p.instagram) || [];

    return NextResponse.json({
      total_without_logos: organizations?.length || 0,
      with_website: withWebsite.length,
      with_instagram: withInstagram.length,
      can_fetch: canFetch.length,
      organizations: organizations || [],
    });
  } catch (err) {
    logger.error("Error checking organizations:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
