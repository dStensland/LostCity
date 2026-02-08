import { createClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/formats";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { apiResponse, escapeSQLPattern } from "@/lib/api-utils";
import { startOfDay, addDays, isSaturday, isSunday, nextSaturday, nextSunday, format } from "date-fns";

function getDateRange(filter: string): { start: string; end: string } | null {
  const now = new Date();
  const today = startOfDay(now);

  switch (filter) {
    case "today":
      return {
        start: format(today, "yyyy-MM-dd"),
        end: format(today, "yyyy-MM-dd"),
      };
    case "weekend": {
      let satDate: Date;
      let sunDate: Date;
      if (isSaturday(now)) {
        satDate = today;
        sunDate = addDays(today, 1);
      } else if (isSunday(now)) {
        satDate = today;
        sunDate = today;
      } else {
        satDate = nextSaturday(today);
        sunDate = nextSunday(today);
      }
      return {
        start: format(satDate, "yyyy-MM-dd"),
        end: format(sunDate, "yyyy-MM-dd"),
      };
    }
    case "week":
      return {
        start: format(today, "yyyy-MM-dd"),
        end: format(addDays(today, 6), "yyyy-MM-dd"),
      };
    default:
      return null;
  }
}

export async function GET(request: Request) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);
    const supabase = await createClient();
    const today = getLocalDateString();

    let query = supabase
      .from("festivals")
      .select("id, name, slug, website, location, neighborhood, categories, free, announced_start, announced_end, ticket_url, description, image_url, typical_month, typical_duration_days, festival_type, portal_id")
      .not("announced_start", "is", null)
      .or(`announced_end.gte.${today},announced_end.is.null`)
      .order("announced_start", { ascending: true })
      .limit(50);

    // Portal filter - only show festivals for the requested portal
    const portalId = searchParams.get("portal_id");
    if (portalId) {
      query = query.eq("portal_id", portalId);
    }

    // Search filter
    const search = searchParams.get("search");
    if (search) {
      const escaped = escapeSQLPattern(search);
      query = query.ilike("name", `%${escaped}%`);
    }

    // Categories filter (overlaps with festivals.categories array)
    const categories = searchParams.get("categories")?.split(",").filter(Boolean);
    if (categories && categories.length > 0) {
      query = query.overlaps("categories", categories);
    }

    // Neighborhoods filter
    const neighborhoods = searchParams.get("neighborhoods")?.split(",").filter(Boolean);
    if (neighborhoods && neighborhoods.length > 0) {
      query = query.in("neighborhood", neighborhoods);
    }

    // Free filter
    const price = searchParams.get("price");
    if (price === "free") {
      query = query.eq("free", true);
    }

    // Date filter - festival overlaps with the requested date range
    const dateFilter = searchParams.get("date");
    if (dateFilter) {
      const range = getDateRange(dateFilter);
      if (range) {
        // Festival overlaps with range if: announced_start <= range.end AND (announced_end >= range.start OR announced_end IS NULL)
        query = query
          .lte("announced_start", range.end)
          .or(`announced_end.gte.${range.start},announced_end.is.null`);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error("Festivals upcoming API error:", error);
      return apiResponse(
        { error: "Failed to fetch festivals", festivals: [] },
        { status: 500 }
      );
    }

    return apiResponse(
      { festivals: data || [] },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Festivals upcoming API error:", error);
    return apiResponse(
      { error: "Failed to fetch festivals", festivals: [] },
      { status: 500 }
    );
  }
}
