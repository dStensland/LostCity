import { createClient } from "@/lib/supabase/server";
import {
  getDestinationNodeIdentityTier,
  sortDestinationNodesForDisplay,
  type DestinationNodeIdentityTier,
} from "@/lib/destination-graph";
import {
  normalizePortalSlug,
  resolvePortalSlugAlias,
} from "@/lib/portal-aliases";
import {
  getSharedCacheJson,
  setSharedCacheJson,
} from "@/lib/shared-cache";
import {
  YONDER_LAUNCH_DESTINATION_NODES,
  YONDER_LAUNCH_DESTINATION_NODE_QUESTS,
  type YonderLaunchDestinationNode,
  type YonderDestinationNodeQuestId,
} from "@/config/yonder-launch-destination-nodes";

const CACHE_NAMESPACE = "api:yonder-destination-nodes";
const CACHE_TTL_MS = 5 * 60 * 1000;

type GuideMention = {
  sourceKey: string;
  articleTitle: string;
  articleUrl: string;
};

export type YonderDestinationNodeCard = {
  id: string;
  title: string;
  destinationNodeType: YonderLaunchDestinationNode["destinationNodeType"];
  // Compatibility alias for older launch surfaces still keyed on artifact terminology.
  artifactType: YonderLaunchDestinationNode["destinationNodeType"];
  relationshipKind: YonderLaunchDestinationNode["relationshipKind"];
  identityTier: DestinationNodeIdentityTier;
  launchPriority: number;
  summary: string;
  questIds: YonderDestinationNodeQuestId[];
  spot: {
    id: number;
    slug: string;
    name: string;
    venueType: string | null;
    city: string | null;
    neighborhood: string | null;
    imageUrl: string | null;
    shortDescription: string | null;
  };
  parentSpot: {
    slug: string;
    name: string;
  } | null;
  guideMention: GuideMention | null;
};

export type YonderDestinationNodePayload = {
  quests: typeof YONDER_LAUNCH_DESTINATION_NODE_QUESTS;
  destinationNodes: YonderDestinationNodeCard[];
  // Compatibility alias for older consumers of the artifact launch surface.
  artifacts: YonderDestinationNodeCard[];
};

type YonderDestinationNodePayloadOptions = {
  questId?: YonderDestinationNodeQuestId | null;
  identityTier?: DestinationNodeIdentityTier | null;
  limit?: number | null;
};

const GUIDE_SOURCE_PRIORITY: Record<string, number> = {
  atlas_obscura: 0,
  atlanta_trails: 1,
  explore_georgia: 2,
  eater_atlanta: 3,
  infatuation_atlanta: 4,
  rough_draft_atlanta: 5,
  atlanta_eats: 6,
};

function emptyPayload(): YonderDestinationNodePayload {
  return {
    quests: [],
    destinationNodes: [],
    artifacts: [],
  };
}

export async function getYonderDestinationNodePayload(
  portalSlug: string,
  options: YonderDestinationNodePayloadOptions = {},
): Promise<YonderDestinationNodePayload> {
  const questId = options.questId ?? null;
  const identityTier = options.identityTier ?? null;
  const limit = options.limit ?? null;
  const canonicalSlug = resolvePortalSlugAlias(normalizePortalSlug(portalSlug));

  if (canonicalSlug !== "yonder") {
    return emptyPayload();
  }

  const cacheBucket = Math.floor(Date.now() / CACHE_TTL_MS);
  const cacheKey = `${canonicalSlug}|${questId ?? "all"}|${identityTier ?? "all"}|${limit ?? "all"}|${cacheBucket}`;
  const cached = await getSharedCacheJson<YonderDestinationNodePayload>(
    CACHE_NAMESPACE,
    cacheKey,
  );
  if (cached) {
    return cached;
  }

  const supabase = await createClient();
  const slugs = [
    ...new Set(
      YONDER_LAUNCH_DESTINATION_NODES.flatMap((entry) =>
        entry.parentSpotSlug
          ? [entry.spotSlug, entry.parentSpotSlug]
          : [entry.spotSlug],
      ),
    ),
  ];
  const { data: venueRows } = await supabase
    .from("venues")
    .select(
      "id, slug, name, venue_type, city, neighborhood, image_url, hero_image_url, short_description",
    )
    .in("slug", slugs)
    .eq("active", true);

  const rows = (venueRows ?? []) as Array<{
    id: number;
    slug: string;
    name: string;
    venue_type: string | null;
    city: string | null;
    neighborhood: string | null;
    image_url: string | null;
    hero_image_url: string | null;
    short_description: string | null;
  }>;

  const rowsBySlug = new Map(rows.map((row) => [row.slug, row]));
  const venueIds = rows.map((row) => row.id);

  const { data: mentionRows } =
    venueIds.length > 0
      ? await supabase
          .from("editorial_mentions")
          .select("venue_id, source_key, article_title, article_url, is_active")
          .in("venue_id", venueIds)
          .eq("is_active", true)
      : { data: [] };

  const mentionsByVenueId = new Map<
    number,
    Array<{
      venue_id: number;
      source_key: string;
      article_title: string;
      article_url: string;
    }>
  >();

  for (const row of (mentionRows ?? []) as Array<{
    venue_id: number;
    source_key: string;
    article_title: string;
    article_url: string;
  }>) {
    const list = mentionsByVenueId.get(row.venue_id) ?? [];
    list.push(row);
    mentionsByVenueId.set(row.venue_id, list);
  }

  const destinationNodes = YONDER_LAUNCH_DESTINATION_NODES.map((artifact) => {
    const venue = rowsBySlug.get(artifact.spotSlug);
    if (!venue) return null;
    const guideMentionRow = (mentionsByVenueId.get(venue.id) ?? [])
      .sort(
        (a, b) =>
          (GUIDE_SOURCE_PRIORITY[a.source_key] ?? 99) -
          (GUIDE_SOURCE_PRIORITY[b.source_key] ?? 99),
      )[0];

    return {
      id: artifact.id,
      title: artifact.title,
      destinationNodeType: artifact.destinationNodeType,
      artifactType: artifact.destinationNodeType,
      relationshipKind: artifact.relationshipKind,
      identityTier: getDestinationNodeIdentityTier(artifact.relationshipKind),
      launchPriority: artifact.launchPriority,
      summary: artifact.summary,
      questIds: artifact.questIds,
      spot: {
        id: venue.id,
        slug: venue.slug,
        name: venue.name,
        venueType: venue.venue_type,
        city: venue.city,
        neighborhood: venue.neighborhood,
        imageUrl: venue.image_url || venue.hero_image_url,
        shortDescription: venue.short_description,
      },
      parentSpot: artifact.parentSpotSlug
        ? (() => {
            const parent = rowsBySlug.get(artifact.parentSpotSlug);
            return parent
              ? {
                  slug: parent.slug,
                  name: parent.name,
                }
              : null;
          })()
        : null,
      guideMention: guideMentionRow
        ? {
            sourceKey: guideMentionRow.source_key,
            articleTitle: guideMentionRow.article_title,
            articleUrl: guideMentionRow.article_url,
          }
        : null,
    } satisfies YonderDestinationNodeCard;
  }).filter(
    (destinationNode): destinationNode is YonderDestinationNodeCard =>
      destinationNode !== null,
  );

  const filteredDestinationNodes = sortDestinationNodesForDisplay(
    destinationNodes.filter((destinationNode) => {
      if (questId && !destinationNode.questIds.includes(questId)) {
        return false;
      }
      if (identityTier && destinationNode.identityTier !== identityTier) {
        return false;
      }
      return true;
    }),
  );
  const limitedDestinationNodes =
    typeof limit === "number" && limit > 0
      ? filteredDestinationNodes.slice(0, limit)
      : filteredDestinationNodes;

  const result = {
    quests: YONDER_LAUNCH_DESTINATION_NODE_QUESTS,
    destinationNodes: limitedDestinationNodes,
    artifacts: limitedDestinationNodes,
  } satisfies YonderDestinationNodePayload;

  await setSharedCacheJson(CACHE_NAMESPACE, cacheKey, result, CACHE_TTL_MS);

  return result;
}
