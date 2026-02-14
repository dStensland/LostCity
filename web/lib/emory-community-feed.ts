import { cache } from "react";
import { addDays } from "date-fns";
import { getLocalDateString } from "@/lib/formats";
import type { HospitalAudienceMode } from "@/lib/hospital-modes";
import {
  getHospitalSourceGovernanceProfile,
  type CommunityTrackKey,
} from "@/lib/hospital-source-governance";
import {
  isCompetitorExcluded,
  resolveEmorySourcePolicy,
  type EmorySourceTier,
} from "@/lib/emory-source-policy";
import { supabase } from "@/lib/supabase";
import { createServiceClient } from "@/lib/supabase/service";

type TrackKey = CommunityTrackKey;

type TrackDefinition = {
  key: TrackKey;
  title: string;
  blurb: string;
  sourceSlugHints: string[];
  sourceNameHints: string[];
  storyKeywordHints: string[];
  fallbackStories: Array<{
    title: string;
    sourceName: string;
    neighborhood: string | null;
    startDate: string;
    startTime: string | null;
  }>;
};

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

export type EmoryCommunityStory = {
  id: string;
  eventId: number | null;
  title: string;
  summary: string;
  startDate: string;
  startTime: string | null;
  isAllDay: boolean;
  sourceName: string;
  sourceUrl: string;
  sourcePolicyId: string | null;
  sourceTier: EmorySourceTier | null;
  venueName: string | null;
  neighborhood: string | null;
  imageUrl: string | null;
  isMock: boolean;
};

export type EmoryCommunityTrack = {
  key: TrackKey;
  title: string;
  blurb: string;
  sourceNames: string[];
  stories: EmoryCommunityStory[];
};

export type EmoryCommunityDigest = {
  fetchedAt: string;
  governanceProfileId: string;
  isLive: boolean;
  sourceCount: number;
  storyCount: number;
  tracks: EmoryCommunityTrack[];
};

const TRACKS: TrackDefinition[] = [
  {
    key: "prevention",
    title: "Prevention & Community Care",
    blurb: "Upcoming prevention clinics, public-health sessions, and practical family guidance programs.",
    sourceSlugHints: [
      "dekalb-public-health",
      "fulton-county-board-health",
      "cdc",
      "georgia-dph",
      "dekalb-library",
      "hands-on-atlanta",
    ],
    sourceNameHints: [
      "public health",
      "department of public health",
      "board of health",
      "cdc",
      "library",
      "hands on atlanta",
    ],
    storyKeywordHints: [
      "clinic",
      "screening",
      "immunization",
      "vaccin",
      "prevention",
      "health fair",
      "public health",
      "education",
      "caregiver",
    ],
    fallbackStories: [
      {
        title: "Community screening and prevention workshop",
        sourceName: "DeKalb Public Health",
        neighborhood: "Decatur",
        startDate: addDays(new Date(), 4).toISOString().slice(0, 10),
        startTime: "10:00:00",
      },
      {
        title: "Family immunization Q&A and resource clinic",
        sourceName: "Fulton County Board of Health",
        neighborhood: "Downtown",
        startDate: addDays(new Date(), 7).toISOString().slice(0, 10),
        startTime: "14:00:00",
      },
    ],
  },
  {
    key: "food_support",
    title: "Food Access & Family Support",
    blurb: "Food security, meal support, and practical assistance for families navigating treatment schedules.",
    sourceSlugHints: [
      "atlanta-community-food-bank",
      "open-hand-atlanta",
      "meals-on-wheels-atlanta",
      "food-well-alliance",
      "giving-kitchen",
      "united-way-atlanta",
    ],
    sourceNameHints: [
      "food bank",
      "open hand",
      "meals on wheels",
      "food well",
      "giving kitchen",
      "united way",
    ],
    storyKeywordHints: [
      "food",
      "meal",
      "nutrition",
      "pantry",
      "produce",
      "grocer",
      "distribution",
      "family support",
      "caregiver",
    ],
    fallbackStories: [
      {
        title: "Mobile pantry distribution near Emory campuses",
        sourceName: "Atlanta Community Food Bank",
        neighborhood: "Druid Hills",
        startDate: addDays(new Date(), 3).toISOString().slice(0, 10),
        startTime: "09:30:00",
      },
      {
        title: "Nutrition support intake for caregiver households",
        sourceName: "Open Hand Atlanta",
        neighborhood: "Midtown",
        startDate: addDays(new Date(), 6).toISOString().slice(0, 10),
        startTime: "11:00:00",
      },
    ],
  },
  {
    key: "community_wellness",
    title: "Community Wellness & Movement",
    blurb: "Non-commercial outdoor activity, mental wellness, and neighborhood movement programs.",
    sourceSlugHints: [
      "beltline",
      "park-pride",
      "decatur-recreation",
      "ymca-atlanta",
      "atlanta-track-club",
      "home-depot-backyard",
      "nami-georgia",
      "mha-georgia",
      "central-rock-gym-atlanta",
      "chattahoochee-nature",
    ],
    sourceNameHints: [
      "beltline",
      "parks",
      "recreation",
      "ymca",
      "track club",
      "home depot backyard",
      "nami",
      "mental health america",
      "nature center",
    ],
    storyKeywordHints: [
      "wellness",
      "movement",
      "walk",
      "yoga",
      "mental health",
      "mindful",
      "fitness",
      "stress",
      "community class",
    ],
    fallbackStories: [
      {
        title: "Neighborhood wellness walk and stress reset",
        sourceName: "Atlanta BeltLine",
        neighborhood: "Old Fourth Ward",
        startDate: addDays(new Date(), 2).toISOString().slice(0, 10),
        startTime: "18:00:00",
      },
      {
        title: "Community mental wellness circle",
        sourceName: "NAMI Georgia",
        neighborhood: "Virtual + Midtown",
        startDate: addDays(new Date(), 8).toISOString().slice(0, 10),
        startTime: "19:00:00",
      },
    ],
  },
];

const MODE_TRACK_PRIORITY: Record<HospitalAudienceMode, TrackKey[]> = {
  urgent: ["prevention", "food_support", "community_wellness"],
  treatment: ["food_support", "prevention", "community_wellness"],
  staff: ["community_wellness", "food_support", "prevention"],
  visitor: ["prevention", "food_support", "community_wellness"],
};

const ATLANTA_PORTAL_SLUG = "atlanta";
const STORY_LIMIT_PER_TRACK = 4;
const TRACK_QUERY_MULTIPLIER = 8;

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

function summarizeDescription(description: string | null, sourceName: string, trackTitle: string): string {
  const cleaned = description ? stripHtml(description) : "";
  if (cleaned.length >= 48) {
    return cleaned.length > 190 ? `${cleaned.slice(0, 187).trimEnd()}...` : cleaned;
  }
  return `Upcoming ${trackTitle.toLowerCase()} update from ${sourceName}.`;
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

function getOrderedTracks(mode: HospitalAudienceMode): TrackDefinition[] {
  const preferredOrder = MODE_TRACK_PRIORITY[mode] || MODE_TRACK_PRIORITY.visitor;
  const trackByKey = new Map(TRACKS.map((track) => [track.key, track] as const));
  const ordered = preferredOrder
    .map((key) => trackByKey.get(key))
    .filter((track): track is TrackDefinition => Boolean(track));

  if (ordered.length === TRACKS.length) {
    return ordered;
  }
  return TRACKS;
}

function scoreStory(args: { story: EmoryCommunityStory; raw: RawEventRow; track: TrackDefinition }): number {
  const { story, raw, track } = args;
  const lowerTitle = story.title.toLowerCase();
  const lowerDesc = stripHtml(raw.description || "").toLowerCase();
  let score = 0;

  if (!isLowSignalTitle(story.title)) score += 2.2;
  if (story.title.length >= 18 && story.title.length <= 115) score += 0.7;
  if (lowerDesc.length >= 48) score += 0.4;
  if (story.neighborhood) score += 0.25;

  const keywordMatches = countKeywordMatches(`${lowerTitle} ${lowerDesc}`, track.storyKeywordHints);
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
  trackKey: TrackKey,
  fallback: TrackDefinition["fallbackStories"][number],
  index: number
): EmoryCommunityStory {
  const policyItem = resolveEmorySourcePolicy({ name: fallback.sourceName });

  return {
    id: `mock-${trackKey}-${index}`,
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

function matchesTrack(
  source: SourceRow,
  track: TrackDefinition,
  allowedPolicySourceIds: string[]
): boolean {
  if (!allowedPolicySourceIds.includes(source.policyId)) {
    return false;
  }

  const slug = (source.slug || "").toLowerCase();
  const name = source.name.toLowerCase();

  if (track.sourceSlugHints.some((hint) => slug === hint || slug.includes(hint))) {
    return true;
  }

  return track.sourceNameHints.some((hint) => name.includes(hint));
}

async function getAtlantaPortalId(client: ReturnType<typeof getReadClient>): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from("portals")
    .select("id")
    .eq("slug", ATLANTA_PORTAL_SLUG)
    .maybeSingle();

  if (error || !data?.id) {
    return null;
  }

  return String(data.id);
}

async function getAtlantaSources(
  client: ReturnType<typeof getReadClient>,
  atlantaPortalId: string | null,
  competitorExclusions: readonly string[]
): Promise<SourceRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client as any)
    .from("sources")
    .select("id, slug, name, url, owner_portal_id")
    .eq("is_active", true);

  if (atlantaPortalId) {
    query = query.eq("owner_portal_id", atlantaPortalId);
  }

  const { data, error } = await query;
  if (error || !Array.isArray(data)) {
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
      const policyItem = resolveEmorySourcePolicy({
        slug: source.slug,
        name: source.name,
      });
      if (!policyItem || policyItem.rail !== "atlanta_federated") {
        return null;
      }
      return {
        ...source,
        policyId: policyItem.id,
        policyTier: policyItem.tier,
      } satisfies SourceRow;
    })
    .filter((source): source is SourceRow => source !== null);
}

async function getTrackStories(args: {
  client: ReturnType<typeof getReadClient>;
  track: TrackDefinition;
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
    track,
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
    .limit(limit * TRACK_QUERY_MULTIPLIER);

  if (error || !Array.isArray(data)) return [];

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
    const score = scoreStory({ story, raw, track });
    if (score < minStoryScore) continue;

    ranked.push({
      story: {
        ...story,
        sourcePolicyId: sourcePolicy.policyId,
        sourceTier: sourcePolicy.policyTier,
        summary: summarizeDescription(raw.description, story.sourceName, track.title),
      },
      score,
    });
  }

  return ranked
    .sort((a, b) => b.score - a.score || a.story.startDate.localeCompare(b.story.startDate))
    .slice(0, limit)
    .map((entry) => entry.story);
}

const getCachedDigest = cache(async (
  portalSlug: string,
  mode: HospitalAudienceMode
): Promise<EmoryCommunityDigest> => {
  const governanceProfile = getHospitalSourceGovernanceProfile(portalSlug);
  const client = getReadClient();
  const atlantaPortalId = await getAtlantaPortalId(client);
  const sources = await getAtlantaSources(client, atlantaPortalId, governanceProfile.competitorExclusions);
  const today = getLocalDateString();
  const horizonDate = getLocalDateString(addDays(new Date(), 45));
  const orderedTracks = getOrderedTracks(mode);

  const tracks: EmoryCommunityTrack[] = [];
  let sourceCount = 0;
  let storyCount = 0;
  let usedFallback = false;

  for (const trackDef of orderedTracks) {
    const allowedPolicySourceIds = governanceProfile.trackSourcePolicyIds[trackDef.key] || [];
    const trackSources = sources.filter((source) => matchesTrack(source, trackDef, allowedPolicySourceIds));
    const sourceIds = trackSources.map((source) => source.id);
    const sourceNames = trackSources.map((source) => source.name);
    const sourcePolicyById = new Map(
      trackSources.map((source) => [source.id, { policyId: source.policyId, policyTier: source.policyTier }] as const)
    );
    sourceCount += sourceIds.length;

    const liveStories = await getTrackStories({
      client,
      track: trackDef,
      sourceIds,
      sourcePolicyById,
      allowedPolicySourceIds,
      competitorExclusions: governanceProfile.competitorExclusions,
      minStoryScore: governanceProfile.minStoryScore,
      today,
      horizonDate,
      limit: STORY_LIMIT_PER_TRACK,
    });

    const stories = liveStories.length > 0
      ? liveStories
      : trackDef.fallbackStories.map((fallback, index) => toFallbackStory(trackDef.key, fallback, index));

    if (liveStories.length === 0) {
      usedFallback = true;
    }

    storyCount += stories.filter((story) => !story.isMock).length;

    tracks.push({
      key: trackDef.key,
      title: trackDef.title,
      blurb: trackDef.blurb,
      sourceNames: sourceNames.slice(0, 4),
      stories,
    });
  }

  return {
    fetchedAt: new Date().toISOString(),
    governanceProfileId: governanceProfile.id,
    isLive: !usedFallback,
    sourceCount,
    storyCount,
    tracks,
  };
});

export async function getEmoryCommunityDigest(args: {
  portalSlug: string;
  mode: HospitalAudienceMode;
}): Promise<EmoryCommunityDigest> {
  return getCachedDigest(args.portalSlug, args.mode);
}
