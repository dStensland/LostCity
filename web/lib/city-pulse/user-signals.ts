/**
 * User signal loading for City Pulse personalization.
 *
 * Loads preferences, followed entity IDs, and friend IDs in parallel
 * then resolves source-to-org mappings for producer following.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserFollowedEntityIds } from "@/lib/follows";
import type { UserSignals } from "@/lib/city-pulse/types";

/**
 * Load all personalization signals for an authenticated user.
 * Returns null when userId is null (anonymous visitor).
 */
export async function loadUserSignals(
  supabase: SupabaseClient,
  userId: string | null,
  portalId: string,
): Promise<UserSignals | null> {
  if (!userId) return null;

  const [prefsResult, followedEntityIdsResult, friendIdsResult] =
    await Promise.all([
      supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      getUserFollowedEntityIds(supabase, userId, {
        portalId,
        includeUnscoped: true,
      }),
      supabase.rpc(
        "get_friend_ids" as never,
        { user_id: userId } as never,
      ) as unknown as Promise<{
        data: { friend_id: string }[] | null;
      }>,
    ]);

  const followedVenueIds = followedEntityIdsResult.followedVenueIds;
  const followedOrganizationIds = followedEntityIdsResult.followedOrganizationIds;

  const friendIds = (friendIdsResult.data || []).map((r) => r.friend_id);

  // Source → org mapping for producer-following signal
  let producerSourceIds: number[] = [];
  const sourceOrganizationMap: Record<number, string> = {};
  if (followedOrganizationIds.length > 0) {
    const { data: sources } = await supabase
      .from("sources")
      .select("id, organization_id")
      .in("organization_id", followedOrganizationIds);
    if (sources) {
      producerSourceIds = sources.map((s: { id: number }) => s.id);
      for (const s of sources as { id: number; organization_id: string }[]) {
        sourceOrganizationMap[s.id] = s.organization_id;
      }
    }
  }

  return {
    userId,
    followedVenueIds,
    followedOrganizationIds,
    producerSourceIds,
    sourceOrganizationMap,
    friendIds,
    prefs: prefsResult.data as UserSignals["prefs"],
  };
}
