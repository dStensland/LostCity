import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

// Portal configs — slugs verified against migrations
// helpatl (288), arts-atlanta (447), hooky (322), yonder (516 — adventure/Lost Track)
const PORTAL_CONFIGS = [
  { slug: "helpatl", label: "LOST CITIZEN", accent: "#2D6A4F" },
  { slug: "arts-atlanta", label: "LOST ARTS", accent: "#C9874F" },
  { slug: "hooky", label: "LOST YOUTH", accent: "#5E7A5E" },
  { slug: "yonder", label: "LOST TRACK", accent: "#C45A3B" },
] as const;

interface PortalHeadline {
  portal: {
    slug: string;
    label: string;
    accent_color: string;
  };
  headline: string;
  context: string;
  href: string;
}

function isPortalHeadline(value: unknown): value is PortalHeadline {
  return value !== null && typeof value === "object";
}

// GET /api/portals/[slug]/headlines
// Returns one upcoming headline event per active sibling portal.
// The [slug] param is the requesting portal (used for cache keying).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];

    // Resolve portal IDs in a single query — avoid N+1 by batching
    const { data: portals, error: portalsError } = await supabase
      .from("portals")
      .select("id, slug")
      .in(
        "slug",
        PORTAL_CONFIGS.map((p) => p.slug),
      )
      .eq("status", "active") as unknown as {
        data: Array<{ id: string; slug: string }> | null;
        error: unknown;
      };

    if (portalsError) {
      logger.error("headlines: failed to load portals", { error: portalsError });
      return NextResponse.json({ headlines: [] });
    }

    if (!portals || portals.length === 0) {
      return NextResponse.json({ headlines: [] });
    }

    const portalById = new Map(portals.map((p) => [p.slug, p.id]));

    // Fetch one upcoming event per portal — Promise.all for parallelism
    const headlineResults = await Promise.all(
      PORTAL_CONFIGS.map(async (config) => {
        const portalId = portalById.get(config.slug);
        if (!portalId) return null;

        const { data: event } = await supabase
          .from("events")
          .select("id, title, start_date, start_time, venue:places(name)")
          .eq("portal_id", portalId as never)
          .eq("is_active", true as never)
          .gte("start_date", today as never)
          .order("start_date", { ascending: true })
          .limit(1)
          .maybeSingle() as unknown as {
            data: {
              id: number;
              title: string;
              start_date: string;
              start_time: string | null;
              venue: { name: string } | null;
            } | null;
          };

        if (!event) return null;

        // Build context line: venue · date
        const venueName = event.venue?.name ?? null;
        const dateStr = event.start_date
          ? new Date(event.start_date + "T12:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          : null;
        const context = [venueName, dateStr].filter(Boolean).join(" · ");

        const result: PortalHeadline = {
          portal: {
            slug: config.slug,
            label: config.label,
            accent_color: config.accent,
          },
          headline: event.title,
          context,
          href: `/${config.slug}/events/${event.id}`,
        };
        return result;
      }),
    );

    const headlines = headlineResults.filter(isPortalHeadline);

    return NextResponse.json(
      { headlines },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    logger.error("headlines: unexpected error", { error });
    return NextResponse.json({ headlines: [] });
  }
}
