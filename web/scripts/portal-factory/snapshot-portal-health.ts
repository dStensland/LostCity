import { createClient } from "@supabase/supabase-js";
import { resolveNetworkFeedAccess } from "@/lib/network-feed-access";
import { loadBestEffortEnv, resolveWorkspaceRoot } from "./manifest-utils";

type PortalRow = {
  id: string;
  slug: string;
  status: string | null;
  parent_portal_id: string | null;
};

type InterestChannelRow = {
  id: string;
  slug: string;
};

type VolunteerOpportunityRow = {
  commitment_level: string | null;
  metadata: {
    cause?: string | null;
  } | null;
};

function parsePortalSlugs(argv: string[]): string[] {
  const values = argv
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length > 0 ? [...new Set(values)] : ["helpatl"];
}

function normalizeCommitmentLevel(value: string | null): string {
  if (!value) {
    return "unknown";
  }

  if (value === "lead_role") {
    return "lead";
  }

  return value;
}

function lastNDaysIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function dateOffsetIso(days: number): string {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

async function countNetworkPosts30d(supabase: ReturnType<typeof createClient>, portalId: string): Promise<number> {
  const { count, error } = await supabase
    .from("network_posts")
    .select("id", { count: "exact", head: true })
    .eq("portal_id", portalId)
    .gte("published_at", lastNDaysIso(30));

  if (error) {
    throw new Error(`Failed counting network posts for portal ${portalId}: ${error.message}`);
  }

  return count || 0;
}

async function getPortalRow(
  supabase: ReturnType<typeof createClient>,
  portalSlug: string,
): Promise<PortalRow> {
  const { data, error } = await supabase
    .from("portals")
    .select("id, slug, status, parent_portal_id")
    .eq("slug", portalSlug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed loading portal ${portalSlug}: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Portal not found: ${portalSlug}`);
  }

  return data as PortalRow;
}

async function getActiveChannelRows(
  supabase: ReturnType<typeof createClient>,
  portalId: string,
): Promise<InterestChannelRow[]> {
  const { data, error } = await supabase
    .from("interest_channels")
    .select("id, slug")
    .eq("portal_id", portalId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Failed loading active channels for portal ${portalId}: ${error.message}`);
  }

  return (data || []) as InterestChannelRow[];
}

async function countDistinctChannelEvents(
  supabase: ReturnType<typeof createClient>,
  portalId: string,
  channelId: string,
  endDateDays: number,
): Promise<number> {
  const { data, error } = await supabase
    .from("event_channel_matches")
    .select("event_id, events!inner(id, is_active, start_date)")
    .eq("portal_id", portalId)
    .eq("channel_id", channelId)
    .eq("events.is_active", true)
    .gte("events.start_date", new Date().toISOString().slice(0, 10))
    .lte("events.start_date", dateOffsetIso(endDateDays));

  if (error) {
    throw new Error(`Failed loading channel events for channel ${channelId}: ${error.message}`);
  }

  return new Set((data || []).map((row) => row.event_id)).size;
}

async function getVolunteerOpportunityRows(
  supabase: ReturnType<typeof createClient>,
  portalId: string,
): Promise<VolunteerOpportunityRow[]> {
  const { data, error } = await supabase
    .from("volunteer_opportunities")
    .select("commitment_level, metadata")
    .eq("portal_id", portalId)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed loading volunteer opportunities for portal ${portalId}: ${error.message}`);
  }

  return (data || []) as VolunteerOpportunityRow[];
}

async function countSourceSubscriptions(
  supabase: ReturnType<typeof createClient>,
  portalId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("source_subscriptions")
    .select("source_id", { count: "exact", head: true })
    .eq("subscriber_portal_id", portalId)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed counting source subscriptions for portal ${portalId}: ${error.message}`);
  }

  return count || 0;
}

async function countAccessibleSources(
  supabase: ReturnType<typeof createClient>,
  portalId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("portal_source_access")
    .select("source_id", { count: "exact", head: true })
    .eq("portal_id", portalId);

  if (error) {
    throw new Error(`Failed counting accessible sources for portal ${portalId}: ${error.message}`);
  }

  return count || 0;
}

async function countEventChannelMatches(
  supabase: ReturnType<typeof createClient>,
  portalId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("event_channel_matches")
    .select("event_id", { count: "exact", head: true })
    .eq("portal_id", portalId);

  if (error) {
    throw new Error(`Failed counting event_channel_matches for portal ${portalId}: ${error.message}`);
  }

  return count || 0;
}

async function summarizePortal(supabase: ReturnType<typeof createClient>, portalSlug: string): Promise<void> {
  const portal = await getPortalRow(supabase, portalSlug);
  const channels = await getActiveChannelRows(supabase, portal.id);
  const channelBySlug = new Map(channels.map((channel) => [channel.slug, channel]));
  const networkAccess = await resolveNetworkFeedAccess(supabase, portal);

  const [
    liveEventSources,
    accessibleLiveEventSources,
    eventChannelMatches,
    volunteerRows,
    localNetworkPosts30d,
    accessibleNetworkPostCounts,
  ] = await Promise.all([
    countSourceSubscriptions(supabase, portal.id),
    countAccessibleSources(supabase, portal.id),
    countEventChannelMatches(supabase, portal.id),
    getVolunteerOpportunityRows(supabase, portal.id),
    countNetworkPosts30d(supabase, portal.id),
    Promise.all(networkAccess.accessiblePortalIds.map((portalId) => countNetworkPosts30d(supabase, portalId))),
  ]);

  const accessibleNetworkPosts30d = accessibleNetworkPostCounts.reduce((sum, value) => sum + value, 0);

  const volunteerThisWeekCount = channelBySlug.has("volunteer-this-week-atl")
    ? await countDistinctChannelEvents(supabase, portal.id, channelBySlug.get("volunteer-this-week-atl")!.id, 7)
    : 0;
  const volunteerThisMonthCount = channelBySlug.has("volunteer-this-week-atl")
    ? await countDistinctChannelEvents(supabase, portal.id, channelBySlug.get("volunteer-this-week-atl")!.id, 30)
    : 0;
  const georgiaDemocracyWatchCount = channelBySlug.has("georgia-democracy-watch")
    ? await countDistinctChannelEvents(supabase, portal.id, channelBySlug.get("georgia-democracy-watch")!.id, 30)
    : 0;

  const commitmentCounts = volunteerRows.reduce<Record<string, number>>((acc, row) => {
    const key = normalizeCommitmentLevel(row.commitment_level);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const causeCounts = volunteerRows.reduce<Record<string, number>>((acc, row) => {
    const key = row.metadata?.cause || "uncategorized";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const topCauses = Object.entries(causeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  console.log(`Portal health snapshot: ${portal.slug}`);
  console.log(`  Status: ${portal.status || "unknown"}`);
  console.log(`  Live Event Sources: ${liveEventSources}`);
  console.log(`  Accessible Live Event Sources: ${accessibleLiveEventSources}`);
  console.log(`  Active Channels: ${channels.length}`);
  console.log(`  Event-Channel Matches: ${eventChannelMatches}`);
  console.log(`  Volunteer This Week (next 7d): ${volunteerThisWeekCount}`);
  console.log(`  Volunteer This Week (next 30d): ${volunteerThisMonthCount}`);
  console.log(`  Georgia Democracy Watch (next 30d): ${georgiaDemocracyWatchCount}`);
  console.log(`  Active Ongoing Opportunities: ${volunteerRows.length}`);
  console.log(
    `  Ongoing Role Mix: total=${volunteerRows.length}, ongoing=${commitmentCounts.ongoing || 0}, lead=${commitmentCounts.lead || 0}`,
  );
  console.log(`  Top Causes: ${topCauses.map(([cause, count]) => `${cause} ${count}`).join(", ")}`);
  console.log(`  Local Policy Posts (30d): ${localNetworkPosts30d}`);
  console.log(`  Resolved Policy Posts (30d): ${accessibleNetworkPosts30d}`);
  console.log(`  Local Policy Sources: ${networkAccess.localSourceCount}`);
  console.log(`  Parent Policy Sources: ${networkAccess.parentSourceCount}`);
  console.log(`  Policy Feed Portals: ${networkAccess.accessiblePortalSlugs.join(", ")}`);
}

async function main(): Promise<void> {
  const workspaceRoot = resolveWorkspaceRoot();
  loadBestEffortEnv(workspaceRoot);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY");
  }

  const portalSlugs = parsePortalSlugs(process.argv.slice(2));
  const supabase = createClient(supabaseUrl, serviceKey);

  for (const portalSlug of portalSlugs) {
    await summarizePortal(supabase, portalSlug);
    if (portalSlug !== portalSlugs[portalSlugs.length - 1]) {
      console.log("");
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
