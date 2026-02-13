import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { runPortalStudioOrchestration } from "@/lib/agents/portal-studio/orchestrator";
import type {
  PortalStudioCommercialFocus,
  PortalStudioLifecycle,
  PortalStudioVertical,
} from "@/lib/agents/portal-studio/types";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

type PortalRow = {
  id: string;
  slug: string;
  name: string;
  settings: Record<string, unknown> | null;
  filters: Record<string, unknown> | string | null;
};

type PortalFilters = {
  excluded_competitors?: unknown;
};

const VALID_LIFECYCLE: PortalStudioLifecycle[] = ["discovery", "prototype", "pilot", "launch"];
const VALID_FOCUS: PortalStudioCommercialFocus[] = ["engagement", "sales", "operations"];
const VALID_VERTICAL: PortalStudioVertical[] = ["hotel", "hospital", "city", "community", "film"];

function isValid<T extends string>(value: string | null, allowed: readonly T[]): value is T {
  return !!value && allowed.includes(value as T);
}

function createRequestId(): string {
  const base = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().split("-")[0]
    : Math.random().toString(36).slice(2, 10);
  return `PS-${Date.now().toString(36).toUpperCase()}-${base.toUpperCase()}`;
}

function portalVerticalFromSettings(rawSettings: PortalRow["settings"]): PortalStudioVertical {
  const verticalRaw = typeof rawSettings?.vertical === "string"
    ? rawSettings.vertical.toLowerCase()
    : "";

  if (isValid(verticalRaw, VALID_VERTICAL)) {
    return verticalRaw;
  }
  return "city";
}

function parseExclusions(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function parsePortalFilters(raw: PortalRow["filters"]): PortalFilters {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as PortalFilters;
    } catch {
      return {};
    }
  }
  return raw as PortalFilters;
}

// GET /api/portals/[slug]/studio/orchestrated
// Deterministic multi-agent blueprint packet for white-label portal design and launch planning.
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await context.params;
  const { searchParams } = new URL(request.url);

  const lifecycleParam = searchParams.get("lifecycle");
  const focusParam = searchParams.get("focus");
  const verticalParam = searchParams.get("vertical");
  const wayfindingPartner = (searchParams.get("wayfinding_partner") || "gozio").slice(0, 60);
  const excludedCompetitors = parseExclusions(searchParams.get("exclude_competitors"));

  const lifecycle: PortalStudioLifecycle = isValid(lifecycleParam, VALID_LIFECYCLE)
    ? lifecycleParam
    : "prototype";
  const commercialFocus: PortalStudioCommercialFocus = isValid(focusParam, VALID_FOCUS)
    ? focusParam
    : "sales";

  const supabase = await createClient();
  const { data: portalData, error: portalError } = await supabase
    .from("portals")
    .select("id, slug, name, settings, filters")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  const portal = portalData as PortalRow | null;
  if (portalError || !portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const parsedFilters = parsePortalFilters(portal.filters);
  const defaultCompetitors = Array.isArray(parsedFilters?.excluded_competitors)
    ? parsedFilters.excluded_competitors
        .filter((value: unknown): value is string => typeof value === "string")
        .slice(0, 10)
    : [];

  const vertical: PortalStudioVertical = isValid(verticalParam, VALID_VERTICAL)
    ? verticalParam
    : portalVerticalFromSettings(portal.settings);

  const orchestration = runPortalStudioOrchestration({
    requestId: createRequestId(),
    now: new Date(),
    portal: {
      id: portal.id,
      slug: portal.slug,
      name: portal.name,
      vertical,
    },
    session: {
      lifecycle,
      commercialFocus,
      wayfindingPartner,
      excludedCompetitors: excludedCompetitors.length > 0 ? excludedCompetitors : defaultCompetitors,
    },
  });

  return NextResponse.json(orchestration);
}
