import { cache } from "react";
import type { HospitalAudienceMode } from "@/lib/hospital-modes";
import { getHospitalSourceGovernanceProfile } from "@/lib/hospital-source-governance";
import { isCompetitorExcluded, resolveEmorySourcePolicy, type EmorySourceTier } from "@/lib/emory-source-policy";
import { supabase } from "@/lib/supabase";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getOrderedCategories,
  getCategorySourcePolicyIds,
  type EmoryCommunityCategory,
  type CategorySensitivity,
} from "@/lib/emory-community-categories";
import type { EmoryCommunityStory } from "@/lib/emory-community-feed";
import { SUPPORT_SOURCE_POLICY_ITEMS, resolveSupportSourcePolicy } from "@/lib/support-source-policy";

export type AlwaysAvailableOrg = {
  id: string;
  name: string;
  focus: string;
  url: string;
};

export type EmoryCommunityHubCategory = {
  key: EmoryCommunityCategory;
  title: string;
  blurb: string;
  iconName: string;
  sensitivity: CategorySensitivity;
  keywordHints: string[];
  sourceNames: string[];
  stories: EmoryCommunityStory[];
  alwaysAvailableOrgs: AlwaysAvailableOrg[];
};

export type EmoryCommunityHubDigest = {
  fetchedAt: string;
  isLive: boolean;
  sourceCount: number;
  storyCount: number;
  categories: EmoryCommunityHubCategory[];
};

const SUPPORT_PORTAL_SLUG = "atlanta-support";

type SourceRow = {
  id: number;
  slug: string | null;
  name: string;
  url: string | null;
  policyId: string;
  policyTier: EmorySourceTier;
};

function getReadClient() {
  try {
    return createServiceClient();
  } catch {
    return supabase;
  }
}

function safeText(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

async function getSupportPortalId(client: ReturnType<typeof getReadClient>): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from("portals")
    .select("id")
    .eq("slug", SUPPORT_PORTAL_SLUG)
    .maybeSingle();

  if (error) {
    console.error("[emory-community] Failed to fetch support portal ID:", error.message);
    return null;
  }

  if (!data?.id) {
    return null;
  }

  return String(data.id);
}

async function getSupportSources(
  client: ReturnType<typeof getReadClient>,
  supportPortalId: string | null,
  competitorExclusions: readonly string[]
): Promise<SourceRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client as any)
    .from("sources")
    .select("id, slug, name, url, owner_portal_id")
    .eq("is_active", true);

  if (supportPortalId) {
    query = query.eq("owner_portal_id", supportPortalId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[emory-community] Failed to fetch support sources:", error.message);
    return [];
  }
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((row) => ({
      id: Number(row.id),
      slug: typeof row.slug === "string" ? row.slug : null,
      name: safeText(row.name, "Atlanta Source"),
      url: typeof row.url === "string" ? row.url : null,
    }))
    .filter((source) => Number.isFinite(source.id))
    .filter(
      (source) =>
        !isCompetitorExcluded(source.slug || "", competitorExclusions) &&
        !isCompetitorExcluded(source.name, competitorExclusions)
    )
    .map((source) => {
      const emoryPolicy = resolveEmorySourcePolicy({
        slug: source.slug,
        name: source.name,
      });
      const supportPolicy = emoryPolicy
        ? null
        : resolveSupportSourcePolicy({
            slug: source.slug,
            name: source.name,
          });
      if (!emoryPolicy && !supportPolicy) {
        return null;
      }
      return {
        ...source,
        policyId: emoryPolicy?.id ?? supportPolicy!.id,
        policyTier: emoryPolicy?.tier ?? ("Tier 2" as EmorySourceTier),
      } satisfies SourceRow;
    })
    .filter((source): source is SourceRow => source !== null);
}

function getAlwaysAvailableOrgs(
  categoryDef: { trackKeys: readonly string[] },
  sourcesWithEvents: Set<string>
): AlwaysAvailableOrg[] {
  const orgs: AlwaysAvailableOrg[] = [];

  for (const trackKey of categoryDef.trackKeys) {
    const policyItems = SUPPORT_SOURCE_POLICY_ITEMS.filter((item) => item.track === trackKey);
    for (const policyItem of policyItems) {
      if (!sourcesWithEvents.has(policyItem.id)) {
        orgs.push({
          id: policyItem.id,
          name: policyItem.name,
          focus: policyItem.focus,
          url: policyItem.url,
        });
      }
    }
  }

  return orgs;
}

const getCachedDigest = cache(
  async (
    portalSlug: string,
    mode: HospitalAudienceMode,
    includeSensitive: boolean
  ): Promise<EmoryCommunityHubDigest> => {
    const governanceProfile = getHospitalSourceGovernanceProfile(portalSlug);
    const client = getReadClient();
    const supportPortalId = await getSupportPortalId(client);
    const sources = await getSupportSources(client, supportPortalId, governanceProfile.competitorExclusions);
    const orderedCategories = getOrderedCategories(mode, includeSensitive);

    // Build category metadata and org lists without per-category story queries.
    // Stories are no longer consumed — the Discovery Deck gets its events from
    // the federation showcase instead. This eliminates ~7 DB round-trips.
    const categories: EmoryCommunityHubCategory[] = [];
    let sourceCount = 0;

    for (const categoryDef of orderedCategories) {
      const allowedPolicySourceIds = getCategorySourcePolicyIds(categoryDef);
      const categorySources = sources.filter((source) =>
        allowedPolicySourceIds.includes(source.policyId)
      );
      const sourceNames = categorySources.map((source) => source.name);

      sourceCount += categorySources.length;

      // No story fetch → treat all policy orgs as always-available
      const alwaysAvailableOrgs = getAlwaysAvailableOrgs(categoryDef, new Set());

      categories.push({
        key: categoryDef.key,
        title: categoryDef.title,
        blurb: categoryDef.blurb,
        iconName: categoryDef.iconName,
        sensitivity: categoryDef.sensitivity,
        keywordHints: categoryDef.storyKeywordHints,
        sourceNames: sourceNames.slice(0, 4),
        stories: [],
        alwaysAvailableOrgs,
      });
    }

    return {
      fetchedAt: new Date().toISOString(),
      isLive: true,
      sourceCount,
      storyCount: 0,
      categories,
    };
  }
);

export async function getEmoryCommunityHubDigest(args: {
  portalSlug: string;
  mode: HospitalAudienceMode;
  includeSensitive?: boolean;
}): Promise<EmoryCommunityHubDigest> {
  return getCachedDigest(args.portalSlug, args.mode, args.includeSensitive ?? false);
}
