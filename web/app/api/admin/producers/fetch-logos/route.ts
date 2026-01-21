import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

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
    console.error(`Error fetching website ${websiteUrl}:`, error);
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
    console.error(`Error fetching Instagram ${instagramHandle}:`, error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { producerIds, overwrite = false } = body as {
      producerIds?: string[];
      overwrite?: boolean;
    };

    const supabase = getSupabaseAdmin();

    // Fetch producers to update
    let query = supabase
      .from("event_producers")
      .select("id, name, website, instagram, logo_url")
      .eq("hidden", false);

    if (producerIds && producerIds.length > 0) {
      query = query.in("id", producerIds);
    }

    if (!overwrite) {
      query = query.is("logo_url", null);
    }

    const { data: producers, error } = await query;

    if (error) {
      console.error("Error fetching producers:", error);
      return NextResponse.json({ error: "Failed to fetch producers" }, { status: 500 });
    }

    if (!producers || producers.length === 0) {
      return NextResponse.json({
        message: "No producers to update",
        results: []
      });
    }

    const results: LogoResult[] = [];

    for (const producer of producers) {
      // Skip if already has logo and not overwriting
      if (producer.logo_url && !overwrite) {
        results.push({
          id: producer.id,
          name: producer.name,
          status: "skipped",
        });
        continue;
      }

      let logoUrl: string | null = null;

      // Try website first
      if (producer.website) {
        logoUrl = await fetchLogoFromWebsite(producer.website);
      }

      // Fall back to Instagram
      if (!logoUrl && producer.instagram) {
        logoUrl = await fetchInstagramAvatar(producer.instagram);
      }

      if (logoUrl) {
        // Update the database
        const { error: updateError } = await supabase
          .from("event_producers")
          .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
          .eq("id", producer.id);

        if (updateError) {
          results.push({
            id: producer.id,
            name: producer.name,
            status: "failed",
            error: updateError.message,
          });
        } else {
          results.push({
            id: producer.id,
            name: producer.name,
            status: "success",
            logo_url: logoUrl,
          });
        }
      } else {
        results.push({
          id: producer.id,
          name: producer.name,
          status: "failed",
          error: "No logo found from website or Instagram",
        });
      }
    }

    const successCount = results.filter(r => r.status === "success").length;
    const failedCount = results.filter(r => r.status === "failed").length;
    const skippedCount = results.filter(r => r.status === "skipped").length;

    return NextResponse.json({
      message: `Processed ${results.length} producers: ${successCount} success, ${failedCount} failed, ${skippedCount} skipped`,
      results,
      summary: { success: successCount, failed: failedCount, skipped: skippedCount },
    });
  } catch (err) {
    console.error("Error in fetch-logos API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET endpoint to check producers without logos
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data: producers, error } = await supabase
      .from("event_producers")
      .select("id, name, website, instagram, logo_url")
      .eq("hidden", false)
      .is("logo_url", null)
      .order("name");

    if (error) {
      return NextResponse.json({ error: "Failed to fetch producers" }, { status: 500 });
    }

    const withWebsite = producers?.filter(p => p.website) || [];
    const withInstagram = producers?.filter(p => p.instagram) || [];
    const canFetch = producers?.filter(p => p.website || p.instagram) || [];

    return NextResponse.json({
      total_without_logos: producers?.length || 0,
      with_website: withWebsite.length,
      with_instagram: withInstagram.length,
      can_fetch: canFetch.length,
      producers: producers || [],
    });
  } catch (err) {
    console.error("Error checking producers:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
