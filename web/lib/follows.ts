import type { AnySupabase } from "@/lib/api-utils";
import { isValidUUID } from "@/lib/api-utils";

type FollowRow = {
  followed_venue_id: number | null;
  followed_organization_id: string | null;
};

export type UserFollowedEntityIds = {
  followedVenueIds: number[];
  followedOrganizationIds: string[];
};

export function buildFollowPortalScopeFilter(
  portalId: string | null,
  includeUnscoped: boolean,
): string | null {
  if (!portalId || !isValidUUID(portalId)) return null;
  return includeUnscoped
    ? `portal_id.eq.${portalId},portal_id.is.null`
    : `portal_id.eq.${portalId}`;
}

export async function getUserFollowedEntityIds(
  supabase: AnySupabase,
  userId: string,
  options?: {
    portalId?: string | null;
    includeUnscoped?: boolean;
  },
): Promise<UserFollowedEntityIds> {
  const portalId = options?.portalId || null;
  const includeUnscoped = options?.includeUnscoped ?? true;

  let query = supabase
    .from("follows")
    .select("followed_venue_id, followed_organization_id")
    .eq("follower_id", userId);

  const portalScopeFilter = buildFollowPortalScopeFilter(portalId, includeUnscoped);
  if (portalScopeFilter) {
    query = query.or(portalScopeFilter);
  }

  const { data } = await query;
  const rows = (data || []) as FollowRow[];

  const venueSet = new Set<number>();
  const organizationSet = new Set<string>();

  for (const row of rows) {
    if (typeof row.followed_venue_id === "number") {
      venueSet.add(row.followed_venue_id);
    }
    if (typeof row.followed_organization_id === "string") {
      organizationSet.add(row.followed_organization_id);
    }
  }

  return {
    followedVenueIds: [...venueSet],
    followedOrganizationIds: [...organizationSet],
  };
}
