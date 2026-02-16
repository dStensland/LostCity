import { cache } from "react";
import { addDays } from "date-fns";
import { getLocalDateString } from "@/lib/formats";
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
  type CommunityCategoryDefinition,
} from "@/lib/emory-community-categories";
import type { EmoryCommunityStory } from "@/lib/emory-community-feed";
import { SUPPORT_SOURCE_POLICY_ITEMS, resolveSupportSourcePolicy, type SupportSourcePolicyItem } from "@/lib/support-source-policy";

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
const STORY_LIMIT_PER_CATEGORY = 8;
const CATEGORY_QUERY_MULTIPLIER = 8;
const MIN_STORY_SCORE = 2.0;

type SourceRow = {
  id: number;
  slug: string | null;
  name: string;
  url: string | null;
  policyId: string;
  policyTier: EmorySourceTier;
};

type RawEventRow = {
  id: number;
  source_id: number;
  title: string;
  description: string | null;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean;
  source_url: string | null;
  image_url: string | null;
  source: {
    name: string | null;
    slug: string | null;
    url: string | null;
  } | null;
  venue: {
    name: string | null;
    neighborhood: string | null;
  } | null;
};

const LOW_SIGNAL_TITLE_PATTERNS: RegExp[] = [
  /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\.?$/i,
  /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i,
  /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/,
  /^(flyer|agenda|minutes|newsletter|calendar|events?)$/i,
  /^(tbd|coming soon|more info)$/i,
];

const LOW_SIGNAL_SUBSTRINGS = [
  "pdf",
  "newsletter",
  "board minutes",
  "month at a glance",
  "download",
  "click here",
];

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

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeDescription(description: string | null, sourceName: string, categoryTitle: string): string {
  const cleaned = description ? stripHtml(description) : "";
  if (cleaned.length >= 48) {
    return cleaned.length > 190 ? `${cleaned.slice(0, 187).trimEnd()}...` : cleaned;
  }
  return `Upcoming ${categoryTitle.toLowerCase()} update from ${sourceName}.`;
}

function countKeywordMatches(text: string, hints: string[]): number {
  if (!text) return 0;
  let count = 0;
  for (const hint of hints) {
    if (text.includes(hint)) count += 1;
  }
  return count;
}

function isLowSignalTitle(title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) return true;
  if (trimmed.length < 8) return true;
  if (LOW_SIGNAL_TITLE_PATTERNS.some((pattern) => pattern.test(trimmed))) return true;

  const lowered = trimmed.toLowerCase();
  if (LOW_SIGNAL_SUBSTRINGS.some((term) => lowered.includes(term))) return true;

  const words = lowered.split(/\s+/).filter(Boolean);
  const alphaWords = words.filter((word) => /[a-z]/.test(word));
  if (alphaWords.length <= 1) return true;
  if (alphaWords.every((word) => word.length <= 3) && trimmed.length <= 18) return true;
  return false;
}

function scoreStory(args: {
  story: EmoryCommunityStory;
  raw: RawEventRow;
  category: CommunityCategoryDefinition;
}): number {
  const { story, raw, category } = args;
  const lowerTitle = story.title.toLowerCase();
  const lowerDesc = stripHtml(raw.description || "").toLowerCase();
  let score = 0;

  if (!isLowSignalTitle(story.title)) score += 2.2;
  if (story.title.length >= 18 && story.title.length <= 115) score += 0.7;
  if (lowerDesc.length >= 48) score += 0.4;
  if (story.neighborhood) score += 0.25;

  const keywordMatches = countKeywordMatches(
    `${lowerTitle} ${lowerDesc}`,
    category.storyKeywordHints
  );
  score += Math.min(keywordMatches * 0.6, 1.8);

  if (/newsletter|agenda|minutes|flyer|pdf|download/.test(lowerTitle)) {
    score -= 1.8;
  }
  if (/update|bulletin|weekly|monthly/.test(lowerTitle) && keywordMatches === 0) {
    score -= 1.1;
  }

  return score;
}

function toStoryFromRow(
  row: RawEventRow,
  competitorExclusions: readonly string[]
): EmoryCommunityStory | null {
  const sourceName = safeText(row.source?.name, "Atlanta Source");
  const sourceSlug = row.source?.slug || "";
  const sourceUrl = row.source_url || row.source?.url || "#";
  const title = safeText(row.title, "Community health event");

  if (
    isCompetitorExcluded(sourceName, competitorExclusions) ||
    isCompetitorExcluded(sourceSlug, competitorExclusions) ||
    isCompetitorExcluded(title, competitorExclusions)
  ) {
    return null;
  }

  return {
    id: `event-${row.id}`,
    eventId: row.id,
    title,
    summary: safeText(row.description, "Upcoming community event from Atlanta federated sources."),
    startDate: row.start_date,
    startTime: row.start_time,
    isAllDay: row.is_all_day,
    sourceName,
    sourceUrl,
    sourcePolicyId: null,
    sourceTier: null,
    venueName: row.venue?.name || null,
    neighborhood: row.venue?.neighborhood || null,
    imageUrl: row.image_url || null,
    isMock: false,
  };
}

function toFallbackStory(
  categoryKey: EmoryCommunityCategory,
  fallback: CommunityCategoryDefinition["fallbackStories"][number],
  index: number
): EmoryCommunityStory {
  const policyItem = resolveEmorySourcePolicy({ name: fallback.sourceName });

  return {
    id: `mock-${categoryKey}-${index}`,
    eventId: null,
    title: fallback.title,
    summary: "Community support activity near Emory campuses from trusted Atlanta partners.",
    startDate: fallback.startDate,
    startTime: fallback.startTime,
    isAllDay: false,
    sourceName: fallback.sourceName,
    sourceUrl: "#",
    sourcePolicyId: policyItem?.id || null,
    sourceTier: policyItem?.tier || null,
    venueName: null,
    neighborhood: fallback.neighborhood,
    imageUrl: null,
    isMock: true,
  };
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

async function getCategoryStories(args: {
  client: ReturnType<typeof getReadClient>;
  category: CommunityCategoryDefinition;
  sourceIds: number[];
  sourcePolicyById: Map<number, { policyId: string; policyTier: EmorySourceTier }>;
  allowedPolicySourceIds: string[];
  competitorExclusions: readonly string[];
  minStoryScore: number;
  today: string;
  horizonDate: string;
  limit: number;
}): Promise<EmoryCommunityStory[]> {
  const {
    client,
    category,
    sourceIds,
    sourcePolicyById,
    allowedPolicySourceIds,
    competitorExclusions,
    minStoryScore,
    today,
    horizonDate,
    limit,
  } = args;
  if (sourceIds.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from("events")
    .select(`
      id,
      source_id,
      title,
      description,
      start_date,
      start_time,
      is_all_day,
      source_url,
      image_url,
      source:sources!events_source_id_fkey(name, slug, url),
      venue:venues(name, neighborhood)
    `)
    .in("source_id", sourceIds)
    .gte("start_date", today)
    .lte("start_date", horizonDate)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: false })
    .limit(limit * CATEGORY_QUERY_MULTIPLIER);

  if (error) {
    console.error("[emory-community] Failed to fetch category stories for", category.key, ":", error.message);
    return [];
  }
  if (!Array.isArray(data)) return [];

  const byTitleAndDate = new Set<string>();
  const ranked: Array<{ story: EmoryCommunityStory; score: number }> = [];

  for (const raw of data as RawEventRow[]) {
    const story = toStoryFromRow(raw, competitorExclusions);
    if (!story) continue;
    const sourcePolicy = sourcePolicyById.get(raw.source_id);
    if (!sourcePolicy) continue;
    if (!allowedPolicySourceIds.includes(sourcePolicy.policyId)) continue;

    const dedupeKey = `${story.title.toLowerCase()}|${story.startDate}`;
    if (byTitleAndDate.has(dedupeKey)) continue;
    byTitleAndDate.add(dedupeKey);
    const score = scoreStory({ story, raw, category });
    if (score < minStoryScore) continue;

    ranked.push({
      story: {
        ...story,
        sourcePolicyId: sourcePolicy.policyId,
        sourceTier: sourcePolicy.policyTier,
        summary: summarizeDescription(raw.description, story.sourceName, category.title),
      },
      score,
    });
  }

  return ranked
    .sort((a, b) => b.score - a.score || a.story.startDate.localeCompare(b.story.startDate))
    .slice(0, limit)
    .map((entry) => entry.story);
}

function getAlwaysAvailableOrgs(
  categoryDef: CommunityCategoryDefinition,
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
    const today = getLocalDateString();
    const horizonDate = getLocalDateString(addDays(new Date(), 45));
    const orderedCategories = getOrderedCategories(mode, includeSensitive);

    const categories: EmoryCommunityHubCategory[] = [];
    let sourceCount = 0;
    let storyCount = 0;
    let usedFallback = false;

    const categoryResults = await Promise.all(
      orderedCategories.map(async (categoryDef) => {
        const allowedPolicySourceIds = getCategorySourcePolicyIds(categoryDef);
        const categorySources = sources.filter((source) =>
          allowedPolicySourceIds.includes(source.policyId)
        );
        const sourceIds = categorySources.map((source) => source.id);
        const sourceNames = categorySources.map((source) => source.name);
        const sourcePolicyById = new Map(
          categorySources.map(
            (source) => [source.id, { policyId: source.policyId, policyTier: source.policyTier }] as const
          )
        );

        const liveStories = await getCategoryStories({
          client,
          category: categoryDef,
          sourceIds,
          sourcePolicyById,
          allowedPolicySourceIds,
          competitorExclusions: governanceProfile.competitorExclusions,
          minStoryScore: MIN_STORY_SCORE,
          today,
          horizonDate,
          limit: STORY_LIMIT_PER_CATEGORY,
        });

        const stories =
          liveStories.length > 0
            ? liveStories
            : categoryDef.fallbackStories.map((fallback, index) =>
                toFallbackStory(categoryDef.key, fallback, index)
              );

        const sourcesWithEvents = new Set(
          liveStories
            .map((story) => story.sourcePolicyId)
            .filter((id): id is string => id !== null)
        );

        const alwaysAvailableOrgs = getAlwaysAvailableOrgs(categoryDef, sourcesWithEvents);

        return {
          categoryDef,
          sourceIds,
          sourceNames,
          liveStories,
          stories,
          alwaysAvailableOrgs,
        };
      })
    );

    for (const result of categoryResults) {
      sourceCount += result.sourceIds.length;
      storyCount += result.stories.filter((story) => !story.isMock).length;
      if (result.liveStories.length === 0) {
        usedFallback = true;
      }

      categories.push({
        key: result.categoryDef.key,
        title: result.categoryDef.title,
        blurb: result.categoryDef.blurb,
        iconName: result.categoryDef.iconName,
        sensitivity: result.categoryDef.sensitivity,
        sourceNames: result.sourceNames.slice(0, 4),
        stories: result.stories,
        alwaysAvailableOrgs: result.alwaysAvailableOrgs,
      });
    }

    return {
      fetchedAt: new Date().toISOString(),
      isLive: !usedFallback,
      sourceCount,
      storyCount,
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
