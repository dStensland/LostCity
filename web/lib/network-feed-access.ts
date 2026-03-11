export type NetworkFeedPortal = {
  id: string;
  slug: string;
  parent_portal_id?: string | null;
};

export type NetworkFeedAccessSummary = {
  accessiblePortalIds: string[];
  accessiblePortalSlugs: string[];
  localSourceCount: number;
  parentSourceCount: number;
};

export function buildNetworkFeedAccessSummary(params: {
  portal: NetworkFeedPortal;
  localSourceCount: number;
  parentPortal: { id: string; slug: string } | null;
  parentSourceCount: number;
}): NetworkFeedAccessSummary {
  const { portal, localSourceCount, parentPortal, parentSourceCount } = params;
  const accessiblePortals = [{ id: portal.id, slug: portal.slug }];

  if (parentPortal && parentSourceCount > 0 && parentPortal.id !== portal.id) {
    accessiblePortals.push(parentPortal);
  }

  return {
    accessiblePortalIds: accessiblePortals.map((item) => item.id),
    accessiblePortalSlugs: accessiblePortals.map((item) => item.slug),
    localSourceCount,
    parentSourceCount,
  };
}

async function countActiveNetworkSources(
  supabase: {
    from: (table: string) => {
      select: (columns: string, options?: { count?: "exact"; head?: boolean }) => {
        eq: (column: string, value: string | boolean) => {
          eq: (column: string, value: string | boolean) => Promise<{ count: number | null; error: { message: string } | null }>;
        };
      };
    };
  },
  portalId: string,
): Promise<number> {
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

export async function resolveNetworkFeedAccess(
  supabase: {
    from: (table: string) => {
      select: (columns: string, options?: { count?: "exact"; head?: boolean }) => {
        eq: (column: string, value: string | boolean) => {
          eq?: (column: string, value: string | boolean) => Promise<{ count: number | null; error: { message: string } | null }>;
          maybeSingle?: () => Promise<{ data: NetworkFeedPortal | null; error: { message: string } | null }>;
        };
        maybeSingle?: () => Promise<{ data: NetworkFeedPortal | null; error: { message: string } | null }>;
      };
    };
  },
  portal: NetworkFeedPortal,
): Promise<NetworkFeedAccessSummary> {
  const localSourceCount = await countActiveNetworkSources(supabase, portal.id);

  if (!portal.parent_portal_id) {
    return buildNetworkFeedAccessSummary({
      portal,
      localSourceCount,
      parentPortal: null,
      parentSourceCount: 0,
    });
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
    return buildNetworkFeedAccessSummary({
      portal,
      localSourceCount,
      parentPortal: null,
      parentSourceCount: 0,
    });
  }

  const parentSourceCount = await countActiveNetworkSources(supabase, parentPortal.id);

  return buildNetworkFeedAccessSummary({
    portal,
    localSourceCount,
    parentPortal: { id: parentPortal.id, slug: parentPortal.slug },
    parentSourceCount,
  });
}
