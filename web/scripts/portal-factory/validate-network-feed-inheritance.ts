import { createClient } from "@supabase/supabase-js";
import { loadBestEffortEnv, resolveWorkspaceRoot } from "./manifest-utils";
import { resolveNetworkFeedAccess } from "@/lib/network-feed-access";

type PortalRow = {
  id: string;
  slug: string;
  parent_portal_id: string | null;
};

type ValidationRow = {
  portal_slug: string;
  inherited_from_portal_slug: string | null;
  accessible_feed_portal_slugs: string[];
  local_active_network_sources: number;
  parent_active_network_sources: number;
  resolved_feed_portal_slug: string;
  local_posts_30d: number;
  resolved_posts_30d: number;
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

async function countPosts30d(supabase: ReturnType<typeof createClient>, portalId: string): Promise<number> {
  const { count, error } = await supabase
    .from("network_posts")
    .select("id", { count: "exact", head: true })
    .eq("portal_id", portalId)
    .gte("published_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    throw new Error(`Failed counting network_posts for portal ${portalId}: ${error.message}`);
  }

  return count || 0;
}

async function validatePortal(
  supabase: ReturnType<typeof createClient>,
  portalSlug: string,
): Promise<ValidationRow> {
  const { data: portalData, error: portalError } = await supabase
    .from("portals")
    .select("id, slug, parent_portal_id")
    .eq("slug", portalSlug)
    .eq("status", "active")
    .maybeSingle();

  if (portalError) {
    throw new Error(`Failed loading portal ${portalSlug}: ${portalError.message}`);
  }

  if (!portalData) {
    throw new Error(`Portal not found or inactive: ${portalSlug}`);
  }

  const portal = portalData as PortalRow;
  const access = await resolveNetworkFeedAccess(supabase, portal);
  const [localPosts30d, ...accessiblePostCounts] = await Promise.all([
    countPosts30d(supabase, portal.id),
    ...access.accessiblePortalIds.map((portalId) => countPosts30d(supabase, portalId)),
  ]);
  const resolvedPosts30d = accessiblePostCounts.reduce((sum, count) => sum + count, 0);

  return {
    portal_slug: portal.slug,
    inherited_from_portal_slug:
      access.accessiblePortalSlugs.length > 1 ? access.accessiblePortalSlugs.slice(1).join(", ") : null,
    accessible_feed_portal_slugs: access.accessiblePortalSlugs,
    local_active_network_sources: access.localSourceCount,
    parent_active_network_sources: access.parentSourceCount,
    resolved_feed_portal_slug: access.accessiblePortalSlugs.join(", "),
    local_posts_30d: localPosts30d,
    resolved_posts_30d: resolvedPosts30d,
  };
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

  const rows = await Promise.all(portalSlugs.map((portalSlug) => validatePortal(supabase, portalSlug)));

  console.log("Network feed inheritance validation");
  for (const row of rows) {
    console.log("");
    console.log(`Portal: ${row.portal_slug}`);
    console.log(`  Inherited from: ${row.inherited_from_portal_slug || "none"}`);
    console.log(`  Accessible feed portals: ${row.accessible_feed_portal_slugs.join(", ")}`);
    console.log(`  Local active sources: ${row.local_active_network_sources}`);
    console.log(`  Parent active sources: ${row.parent_active_network_sources}`);
    console.log(`  Resolved feed portal: ${row.resolved_feed_portal_slug}`);
    console.log(`  Local posts (30d): ${row.local_posts_30d}`);
    console.log(`  Resolved posts (30d): ${row.resolved_posts_30d}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
