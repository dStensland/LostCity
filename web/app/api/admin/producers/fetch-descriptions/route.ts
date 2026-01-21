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
    console.error(`Error fetching website ${websiteUrl}:`, error);
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
      .select("id, name, website, description")
      .eq("hidden", false);

    if (producerIds && producerIds.length > 0) {
      query = query.in("id", producerIds);
    }

    if (!overwrite) {
      query = query.is("description", null);
    }

    const { data: producers, error } = await query;

    if (error) {
      console.error("Error fetching producers:", error);
      return NextResponse.json({ error: "Failed to fetch producers" }, { status: 500 });
    }

    // Filter to only those with websites
    const producersWithWebsites = (producers || []).filter(p => p.website);

    if (producersWithWebsites.length === 0) {
      return NextResponse.json({
        message: "No producers to update (no websites available)",
        results: []
      });
    }

    const results: DescriptionResult[] = [];

    for (const producer of producersWithWebsites) {
      // Skip if already has description and not overwriting
      if (producer.description && !overwrite) {
        results.push({
          id: producer.id,
          name: producer.name,
          status: "skipped",
        });
        continue;
      }

      const description = await fetchDescriptionFromWebsite(producer.website);

      if (description) {
        // Update the database
        const { error: updateError } = await supabase
          .from("event_producers")
          .update({ description, updated_at: new Date().toISOString() })
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
            description,
          });
        }
      } else {
        results.push({
          id: producer.id,
          name: producer.name,
          status: "failed",
          error: "No description found on website",
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
    console.error("Error in fetch-descriptions API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET endpoint to check producers without descriptions
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data: producers, error } = await supabase
      .from("event_producers")
      .select("id, name, website, description")
      .eq("hidden", false)
      .is("description", null)
      .order("name");

    if (error) {
      return NextResponse.json({ error: "Failed to fetch producers" }, { status: 500 });
    }

    const withWebsite = producers?.filter(p => p.website) || [];

    return NextResponse.json({
      total_without_descriptions: producers?.length || 0,
      with_website: withWebsite.length,
      can_fetch: withWebsite.length,
      producers: producers || [],
    });
  } catch (err) {
    console.error("Error checking producers:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
