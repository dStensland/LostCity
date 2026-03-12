import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest } from "next/server";
import { getLocalDateString } from "@/lib/formats";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { applyFeedGate } from "@/lib/feed-gate";
import type { AnySupabase } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;

  if (!slug) {
    return Response.json({ error: "Invalid slug" }, { status: 400 });
  }

  const supabase = await createClient();
  const serviceClient = createServiceClient() as unknown as AnySupabase;

  // Fetch organization data
  const { data: organizationData, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("slug", slug)
    .eq("hidden", false)
    .maybeSingle();

  if (error || !organizationData) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  // Cast to avoid TypeScript 'never' type issue
  const organization = organizationData as { id: string; [key: string]: unknown };

  // Get today's date for filtering upcoming events
  const today = getLocalDateString();

  // Fetch upcoming events for this organization
  let eventsQuery = supabase
    .from("events")
    .select(`
      id, title, start_date, start_time, end_time, is_free, price_min, category:category_id,
      venue:venues(id, name, slug, neighborhood)
    `)
    .eq("organization_id", organization.id)
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(30);

  eventsQuery = applyFeedGate(eventsQuery);

  const { data: eventsData } = await eventsQuery;

  const { data: opportunitiesData } = await serviceClient
    .from("volunteer_opportunities")
    .select(`
      id,
      slug,
      title,
      summary,
      description,
      commitment_level,
      time_horizon,
      onboarding_level,
      schedule_summary,
      location_summary,
      skills_required,
      language_support,
      physical_demand,
      min_age,
      family_friendly,
      group_friendly,
      remote_allowed,
      accessibility_notes,
      background_check_required,
      training_required,
      urgency_level,
      application_url,
      source_url,
      updated_at,
      source:sources(id, name, slug, url)
    `)
    .eq("organization_id", organization.id)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(12);

  return Response.json({
    organization: organizationData,
    events: eventsData || [],
    volunteer_opportunities: opportunitiesData || [],
  });
}
