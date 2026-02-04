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

type DescriptionResult = {
  id: string;
  name: string;
  status: "success" | "failed" | "skipped";
  description?: string;
  error?: string;
};

// Try to extract description from website
async function fetchDescriptionFromWebsite(websiteUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LostCityBot/1.0)",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();

    // Try multiple description sources in order of preference
    const patterns = [
      // Open Graph description
      /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i,
      // Standard meta description
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i,
      // Twitter description
      /<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        let description = match[1]
          .trim()
          // Decode HTML entities
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, " ");

        // Skip if too short or looks like a generic site description
        if (description.length < 20) continue;
        if (description.toLowerCase().includes("wordpress")) continue;
        if (description.toLowerCase().includes("just another")) continue;

        // Truncate if too long
        if (description.length > 500) {
          description = description.substring(0, 497) + "...";
        }

        return description;
      }
    }

    // Try to find an about section in the page
    const aboutPatterns = [
      /<section[^>]*(?:id|class)=["'][^"']*about[^"']*["'][^>]*>([\s\S]*?)<\/section>/i,
      /<div[^>]*(?:id|class)=["'][^"']*about[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    ];

    for (const pattern of aboutPatterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        // Strip HTML tags and get first paragraph
        const text = match[1]
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        if (text.length >= 50 && text.length <= 500) {
          return text;
        } else if (text.length > 500) {
          return text.substring(0, 497) + "...";
        }
      }
    }

    return null;
  } catch (error) {
    logger.error(`Error fetching website ${websiteUrl}:`, error);
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
      .select("id, name, website, description")
      .eq("hidden", false);

    if (organizationIds && organizationIds.length > 0) {
      query = query.in("id", organizationIds);
    }

    if (!overwrite) {
      query = query.is("description", null);
    }

    const { data: organizations, error } = await query;

    if (error) {
      logger.error("Error fetching organizations:", error);
      return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
    }

    // Filter to only those with websites
    const organizationsWithWebsites = (organizations || []).filter(p => p.website);

    if (organizationsWithWebsites.length === 0) {
      return NextResponse.json({
        message: "No organizations to update (no websites available)",
        results: []
      });
    }

    const results: DescriptionResult[] = [];

    for (const organization of organizationsWithWebsites) {
      // Skip if already has description and not overwriting
      if (organization.description && !overwrite) {
        results.push({
          id: organization.id,
          name: organization.name,
          status: "skipped",
        });
        continue;
      }

      // Validate URL is safe before fetching
      if (!isValidExternalUrl(organization.website)) {
        results.push({
          id: organization.id,
          name: organization.name,
          status: "failed",
          error: "Invalid or unsafe website URL",
        });
        continue;
      }

      const description = await fetchDescriptionFromWebsite(organization.website);

      if (description) {
        // Update the database
        const { error: updateError } = await supabase
          .from("organizations")
          .update({ description, updated_at: new Date().toISOString() })
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
            description,
          });
        }
      } else {
        results.push({
          id: organization.id,
          name: organization.name,
          status: "failed",
          error: "No description found on website",
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
    logger.error("Error in fetch-descriptions API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET endpoint to check organizations without descriptions
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
      .select("id, name, website, description")
      .eq("hidden", false)
      .is("description", null)
      .order("name");

    if (error) {
      return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
    }

    const withWebsite = organizations?.filter(p => p.website) || [];

    return NextResponse.json({
      total_without_descriptions: organizations?.length || 0,
      with_website: withWebsite.length,
      can_fetch: withWebsite.length,
      organizations: organizations || [],
    });
  } catch (err) {
    logger.error("Error checking organizations:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
