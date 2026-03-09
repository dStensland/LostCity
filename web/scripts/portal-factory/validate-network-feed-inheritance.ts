import { createClient } from "@supabase/supabase-js";
import { loadBestEffortEnv, resolveWorkspaceRoot } from "./manifest-utils";

type PortalRow = {
  id: string;
  slug: string;
  parent_portal_id: string | null;
};

type ValidationRow = {
  portal_slug: string;
  inherited_from_portal_slug: string | null;
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

async function countActiveNetworkSources(supabase: ReturnType<typeof createClient>, portalId: string): Promise<number> {
  const { count, error } = await supabase
    .from("network_sources")
    .select("id", { count: "exact", head: true })
    .eq("portal_id", portalId)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed counting network_sources for portal ${portalId}: ${error.message}`);
  }

  return count || 0;
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

async function resolveFeedPortal(
  supabase: ReturnType<typeof createClient>,
  portal: PortalRow,
): Promise<{ resolvedPortal: PortalRow; localSourceCount: number; parentSourceCount: number }> {
  const localSourceCount = await countActiveNetworkSources(supabase, portal.id);
  if (localSourceCount > 0 || !portal.parent_portal_id) {
    return { resolvedPortal: portal, localSourceCount, parentSourceCount: 0 };
  }

  const { data: parentPortal, error: parentError } = await supabase
    .from("portals")
    .select("id, slug, parent_portal_id")
    .eq("id", portal.parent_portal_id)
    .eq("status", "active")
    .maybeSingle();

  if (parentError) {
    throw new Error(`Failed loading parent portal for ${portal.slug}: ${parentError.message}`);
  }

  if (!parentPortal) {
    return { resolvedPortal: portal, localSourceCount, parentSourceCount: 0 };
  }

  const typedParent = parentPortal as PortalRow;
  const parentSourceCount = await countActiveNetworkSources(supabase, typedParent.id);

  if (parentSourceCount > 0) {
    return {
      resolvedPortal: typedParent,
      localSourceCount,
      parentSourceCount,
    };
  }

  return { resolvedPortal: portal, localSourceCount, parentSourceCount };
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
  const { resolvedPortal, localSourceCount, parentSourceCount } = await resolveFeedPortal(supabase, portal);
  const [localPosts30d, resolvedPosts30d] = await Promise.all([
    countPosts30d(supabase, portal.id),
    countPosts30d(supabase, resolvedPortal.id),
  ]);

  return {
    portal_slug: portal.slug,
    inherited_from_portal_slug: resolvedPortal.slug !== portal.slug ? resolvedPortal.slug : null,
    local_active_network_sources: localSourceCount,
    parent_active_network_sources: parentSourceCount,
    resolved_feed_portal_slug: resolvedPortal.slug,
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
