import { getUserFollowedEntityIds } from "@/lib/follows";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";

const FEED_SOCIAL_GRAPH_CACHE_NAMESPACE = "api:feed:social-graph";
const FEED_SOCIAL_GRAPH_CACHE_TTL_MS = 2 * 60 * 1000;
const FEED_SOCIAL_GRAPH_CACHE_MAX_ENTRIES = 500;

type GetFriendIdsResult = { friend_id: string }[];

export type FeedSocialGraphContext = {
  followedVenueIds: number[];
  followedOrganizationIds: string[];
  producerSourceIds: number[];
  sourceOrganizationMap: Record<number, string>;
  friendIds: string[];
};

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (
        column: string,
        values: (string | number)[],
      ) => Promise<{ data: unknown[] | null }>;
    };
  };
  rpc: (
    fn: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: GetFriendIdsResult | null }>;
};

export async function getCachedFeedSocialGraphContext(
  supabase: SupabaseLike,
  userId: string,
  portalId: string | null,
): Promise<FeedSocialGraphContext> {
  const cacheKey = `${userId}|${portalId || "global"}`;
  const cached = await getSharedCacheJson<FeedSocialGraphContext>(
    FEED_SOCIAL_GRAPH_CACHE_NAMESPACE,
    cacheKey,
  );
  if (cached) {
    return cached;
  }

  const { followedVenueIds, followedOrganizationIds } =
    await getUserFollowedEntityIds(
      supabase as never,
      userId,
      {
        portalId,
        includeUnscoped: true,
      },
    );

  const [producerSourcesResult, friendIdsResult] = await Promise.all([
    followedOrganizationIds.length > 0
      ? supabase
          .from("sources")
          .select("id, organization_id")
          .in("organization_id", followedOrganizationIds)
      : Promise.resolve({ data: [] }),
    supabase.rpc("get_friend_ids", { user_id: userId }),
  ]);

  const producerSourceIds: number[] = [];
  const sourceOrganizationMap: Record<number, string> = {};
  for (const source of (producerSourcesResult.data || []) as {
    id: number;
    organization_id: string;
  }[]) {
    producerSourceIds.push(source.id);
    sourceOrganizationMap[source.id] = source.organization_id;
  }

  const friendIds = (friendIdsResult.data || []).map((row) => row.friend_id);

  const context: FeedSocialGraphContext = {
    followedVenueIds,
    followedOrganizationIds,
    producerSourceIds,
    sourceOrganizationMap,
    friendIds,
  };

  await setSharedCacheJson(
    FEED_SOCIAL_GRAPH_CACHE_NAMESPACE,
    cacheKey,
    context,
    FEED_SOCIAL_GRAPH_CACHE_TTL_MS,
    { maxEntries: FEED_SOCIAL_GRAPH_CACHE_MAX_ENTRIES },
  );

  return context;
}
