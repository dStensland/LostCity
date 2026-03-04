import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { errorResponse, checkBodySize } from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import type { FeedBlockId, FeedLayout } from "@/lib/city-pulse/types";
import { LEGACY_BLOCK_IDS } from "@/lib/city-pulse/types";
import { ALL_INTEREST_IDS } from "@/lib/city-pulse/interests";

const VALID_BLOCK_IDS: FeedBlockId[] = [
  "events", "recurring", "festivals", "experiences", "community", "cinema", "browse",
];

// Valid categories from search-constants.ts
const VALID_CATEGORIES = [
  "music",
  "film",
  "comedy",
  "theater",
  "art",
  "sports",
  "food_drink",
  "nightlife",
  "community",
  "fitness",
  "family",
  "learning",
  "dance",
  "tours",
  "meetup",
  "words",
  "religious",
  "markets",
  "wellness",
  "gaming",
  "outdoors",
  "other",
];

export async function POST(request: NextRequest) {
  const bodySizeResult = checkBodySize(request);
  if (bodySizeResult) return bodySizeResult;

  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate and sanitize all array fields (max 30 items, strings only)
    const sanitizeArray = (val: unknown, max = 30): string[] =>
      Array.isArray(val)
        ? val.filter((v): v is string => typeof v === "string").slice(0, max)
        : [];

    // Validate genre strings (alphanumeric, hyphens, underscores, dots only)
    const isValidGenre = (g: string): boolean => /^[a-z0-9._-]+$/i.test(g);

    const favorite_categories = sanitizeArray(body.favorite_categories).filter(
      (c) => VALID_CATEGORIES.includes(c),
    );
    const favorite_neighborhoods = sanitizeArray(body.favorite_neighborhoods);
    const favorite_vibes = sanitizeArray(body.favorite_vibes);
    const needs_accessibility = sanitizeArray(body.needs_accessibility);
    const needs_dietary = sanitizeArray(body.needs_dietary);
    const needs_family = sanitizeArray(body.needs_family);
    const price_preference =
      typeof body.price_preference === "string" ? body.price_preference : "any";
    const favorite_genres =
      body.favorite_genres &&
      typeof body.favorite_genres === "object" &&
      !Array.isArray(body.favorite_genres)
        ? Object.fromEntries(
            Object.entries(body.favorite_genres as Record<string, unknown>)
              .filter(
                ([k, v]) => VALID_CATEGORIES.includes(k) && Array.isArray(v),
              )
              .map(([k, v]) => [
                k,
                (v as string[])
                  .filter((g) => typeof g === "string" && isValidGenre(g))
                  .slice(0, 30),
              ]),
          )
        : undefined;
    const hide_adult_content =
      typeof body.hide_adult_content === "boolean"
        ? body.hide_adult_content
        : undefined;
    const cross_portal_recommendations =
      typeof body.cross_portal_recommendations === "boolean"
        ? body.cross_portal_recommendations
        : true;

    // Feed layout validation
    let feed_layout: FeedLayout | null | undefined = undefined;
    if (body.feed_layout !== undefined) {
      if (body.feed_layout === null) {
        feed_layout = null; // Reset to default
      } else if (
        typeof body.feed_layout === "object" &&
        (body.feed_layout.version === 1 || body.feed_layout.version === 2) &&
        Array.isArray(body.feed_layout.visible_blocks) &&
        Array.isArray(body.feed_layout.hidden_blocks)
      ) {
        // Detect legacy v1 IDs → reset blocks to defaults, preserve interests
        const allBlocks = [
          ...(body.feed_layout.visible_blocks as string[]),
          ...(body.feed_layout.hidden_blocks as string[]),
        ];
        const hasLegacy = allBlocks.some((b) => LEGACY_BLOCK_IDS.has(b));

        // Validate interests array (shared by both legacy and current)
        let interests: string[] | null | undefined;
        if (body.feed_layout.interests === null) {
          interests = null;
        } else if (Array.isArray(body.feed_layout.interests)) {
          interests = (body.feed_layout.interests as string[])
            .filter((id) => ALL_INTEREST_IDS.includes(id))
            .slice(0, 30);
        }

        if (hasLegacy) {
          // Legacy layout: reset to defaults, keep interests
          feed_layout = {
            visible_blocks: ["events", "recurring", "festivals", "experiences", "community", "cinema"],
            hidden_blocks: [],
            ...(interests !== undefined && { interests }),
            version: 2,
          };
        } else {
          const visible = (body.feed_layout.visible_blocks as string[])
            .filter((b): b is FeedBlockId => VALID_BLOCK_IDS.includes(b as FeedBlockId));
          const hidden = (body.feed_layout.hidden_blocks as string[])
            .filter((b): b is FeedBlockId => VALID_BLOCK_IDS.includes(b as FeedBlockId));
          // Events must always be visible
          if (!visible.includes("events")) visible.unshift("events");

          feed_layout = {
            visible_blocks: visible,
            hidden_blocks: hidden,
            ...(interests !== undefined && { interests }),
            version: 2,
          };
        }
      }
    }

    const serviceClient = createServiceClient();

    // Build payload conditionally — only include fields present in the request
    // to avoid wiping unrelated preference fields on partial updates.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = { user_id: user.id };

    if ("favorite_categories" in body) payload.favorite_categories = favorite_categories;
    if ("favorite_neighborhoods" in body) payload.favorite_neighborhoods = favorite_neighborhoods;
    if ("favorite_vibes" in body) payload.favorite_vibes = favorite_vibes;
    if ("price_preference" in body) payload.price_preference = price_preference;
    if ("cross_portal_recommendations" in body) payload.cross_portal_recommendations = cross_portal_recommendations;
    if (hide_adult_content !== undefined) payload.hide_adult_content = hide_adult_content;
    if (favorite_genres !== undefined) payload.favorite_genres = favorite_genres;
    if ("needs_accessibility" in body) payload.needs_accessibility = needs_accessibility;
    if ("needs_dietary" in body) payload.needs_dietary = needs_dietary;
    if ("needs_family" in body) payload.needs_family = needs_family;
    if (feed_layout !== undefined) payload.feed_layout = feed_layout;

    // Check if row exists — if not, provide defaults for required columns on INSERT
    const { data: existing } = await serviceClient
      .from("user_preferences")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      // First-time INSERT: fill in defaults for fields not in the request
      if (!("favorite_categories" in body)) payload.favorite_categories = [];
      if (!("favorite_neighborhoods" in body)) payload.favorite_neighborhoods = [];
      if (!("favorite_vibes" in body)) payload.favorite_vibes = [];
      if (!("price_preference" in body)) payload.price_preference = "any";
      if (!("cross_portal_recommendations" in body)) payload.cross_portal_recommendations = true;
    }

    const { error } = await (serviceClient as any).from("user_preferences").upsert(
      payload,
      { onConflict: "user_id" },
    );

    if (error) {
      logger.error("Error saving preferences", error);
      return NextResponse.json(
        { error: "Failed to save preferences" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err, "POST /api/preferences");
  }
}

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      logger.error("Error fetching preferences", error);
      return NextResponse.json(
        { error: "Failed to fetch preferences" },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          favorite_categories: [],
          favorite_neighborhoods: [],
          favorite_vibes: [],
          favorite_genres: null,
          price_preference: null,
          needs_accessibility: [],
          needs_dietary: [],
          needs_family: [],
          hide_adult_content: false,
          cross_portal_recommendations: true,
          feed_layout: null,
        },
        {
          headers: {
            "Cache-Control": "private, max-age=120, stale-while-revalidate=300",
          },
        },
      );
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=120, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    return errorResponse(err, "GET /api/preferences");
  }
}
