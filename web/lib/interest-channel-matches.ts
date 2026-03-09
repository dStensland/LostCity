import type { AnySupabase } from "@/lib/api-utils";
import { isValidUUID } from "@/lib/api-utils";

type UserChannelSubscriptionRow = {
  channel_id: string;
  portal_id: string | null;
};

type InterestChannelRow = {
  id: string;
  portal_id: string | null;
  slug: string;
  name: string;
  channel_type: string;
  sort_order: number;
  is_active: boolean;
};

type InterestChannelRuleRow = {
  channel_id: string;
  rule_type: string;
  rule_payload: Record<string, unknown> | null;
  priority: number;
  is_active: boolean;
};

type EventChannelMatchRow = {
  portal_id: string;
  event_id: number;
  channel_id: string;
  matched_rule_types: string[] | null;
  match_reasons: Record<string, unknown> | null;
  matched_at: string;
};

export type MatchableEvent = {
  id: number;
  source_id: number | null;
  organization_id: string | null;
  category: string | null;
  tags?: string[] | null;
  venue_id?: number | null;
  venue?: { id: number } | null;
  venue_city?: string | null;
  venue_state?: string | null;
  venue_lat?: number | null;
  venue_lng?: number | null;
  venue_neighborhood?: string | null;
};

export type EventChannelMatch = {
  channel_id: string;
  channel_slug: string;
  channel_name: string;
  channel_type: string;
  matched_rule_type: string;
};

export type EventChannelMatchResult = {
  matchesByEventId: Map<number, EventChannelMatch[]>;
  subscribedChannelCount: number;
};

export type RefreshEventChannelMatchesResult = {
  portalId: string;
  startDate: string;
  endDate: string;
  channelsConsidered: number;
  eventsScanned: number;
  matchesWritten: number;
  startedAt: string;
  completedAt: string;
};

function buildSubscriptionPortalFilter(
  portalId: string | null,
  includeUnscoped: boolean,
): string | null {
  if (!portalId || !isValidUUID(portalId)) return null;
  return includeUnscoped
    ? `portal_id.eq.${portalId},portal_id.is.null`
    : `portal_id.eq.${portalId}`;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeLower(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : null;
}

function collectNumbers(
  payload: Record<string, unknown> | null,
  singularKeys: string[],
  pluralKeys: string[],
): number[] {
  if (!payload) return [];
  const values: number[] = [];

  for (const key of singularKeys) {
    const raw = payload[key];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      values.push(raw);
    } else if (typeof raw === "string" && raw.trim().length > 0) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) values.push(parsed);
    }
  }

  for (const key of pluralKeys) {
    const raw = payload[key];
    if (!Array.isArray(raw)) continue;
    for (const item of raw) {
      if (typeof item === "number" && Number.isFinite(item)) {
        values.push(item);
      } else if (typeof item === "string" && item.trim().length > 0) {
        const parsed = Number(item);
        if (Number.isFinite(parsed)) values.push(parsed);
      }
    }
  }

  return [...new Set(values)];
}

function collectStrings(
  payload: Record<string, unknown> | null,
  singularKeys: string[],
  pluralKeys: string[],
  lowercase = false,
): string[] {
  if (!payload) return [];
  const values: string[] = [];

  for (const key of singularKeys) {
    const normalized = lowercase
      ? normalizeLower(payload[key])
      : normalizeString(payload[key]);
    if (normalized) values.push(normalized);
  }

  for (const key of pluralKeys) {
    const raw = payload[key];
    if (!Array.isArray(raw)) continue;
    for (const item of raw) {
      const normalized = lowercase ? normalizeLower(item) : normalizeString(item);
      if (normalized) values.push(normalized);
    }
  }

  return [...new Set(values)];
}

function getEventVenueId(event: MatchableEvent): number | null {
  if (typeof event.venue_id === "number") return event.venue_id;
  if (event.venue && typeof event.venue.id === "number") return event.venue.id;
  return null;
}

function toIsoDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function normalizeEventCategoryValue(value: unknown): string | null {
  const normalized = normalizeLower(value);
  if (!normalized) return null;
  if (normalized.includes(".")) {
    const [root] = normalized.split(".");
    return root || null;
  }
  return normalized;
}

const KM_PER_MILE = 1.60934;

/**
 * Haversine distance in miles between two lat/lng points.
 * Self-contained so this module stays importable in Vitest without Node.js side-effects.
 */
function haversineDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c) / KM_PER_MILE;
}

async function resolvePortalAccessibleSourceIds(
  supabase: AnySupabase,
  portalId: string,
): Promise<number[] | null> {
  const { data, error } = await supabase
    .from("portal_source_access")
    .select("source_id")
    .eq("portal_id", portalId);

  if (error) return null;

  const ids = new Set<number>();
  for (const row of (data || []) as Array<{ source_id: number | null }>) {
    if (typeof row.source_id === "number") ids.add(row.source_id);
  }

  return [...ids];
}

function ruleMatchesEvent(rule: InterestChannelRuleRow, event: MatchableEvent): boolean {
  const payload = rule.rule_payload;

  switch (rule.rule_type) {
    case "source": {
      if (typeof event.source_id !== "number") return false;
      const sourceIds = collectNumbers(payload, ["source_id"], ["source_ids"]);
      return sourceIds.includes(event.source_id);
    }
    case "organization": {
      if (!event.organization_id) return false;
      const organizationIds = collectStrings(
        payload,
        ["organization_id"],
        ["organization_ids"],
      );
      return organizationIds.includes(event.organization_id);
    }
    case "venue": {
      const venueId = getEventVenueId(event);
      if (typeof venueId !== "number") return false;
      const venueIds = collectNumbers(payload, ["venue_id"], ["venue_ids"]);
      return venueIds.includes(venueId);
    }
    case "category": {
      const category = normalizeLower(event.category);
      if (!category) return false;
      const categories = collectStrings(
        payload,
        ["category", "category_id"],
        ["categories", "category_ids"],
        true,
      );
      return categories.includes(category);
    }
    case "tag": {
      const eventTags = new Set(
        (event.tags || [])
          .filter((tag): tag is string => typeof tag === "string")
          .map((tag) => tag.toLowerCase()),
      );
      if (eventTags.size === 0) return false;
      const tags = collectStrings(payload, ["tag"], ["tags"], true);
      return tags.some((tag) => eventTags.has(tag));
    }
    case "geo": {
      if (!payload) return false;
      const geoType = normalizeString(payload["type"]);

      if (geoType === "city") {
        const eventCity = normalizeLower(event.venue_city);
        if (!eventCity) return false;
        const cities = collectStrings(payload, [], ["cities"], true);
        return cities.includes(eventCity);
      }

      if (geoType === "state") {
        const eventState = normalizeLower(event.venue_state);
        if (!eventState) return false;
        const states = collectStrings(payload, [], ["states"], true);
        return states.includes(eventState);
      }

      if (geoType === "radius") {
        const eventLat = event.venue_lat;
        const eventLng = event.venue_lng;
        if (typeof eventLat !== "number" || typeof eventLng !== "number") return false;
        const centerLat =
          typeof payload["center_lat"] === "number" ? payload["center_lat"] : null;
        const centerLng =
          typeof payload["center_lng"] === "number" ? payload["center_lng"] : null;
        const radiusMiles =
          typeof payload["radius_miles"] === "number" ? payload["radius_miles"] : null;
        if (centerLat === null || centerLng === null || radiusMiles === null) return false;
        return haversineDistanceMiles(centerLat, centerLng, eventLat, eventLng) <= radiusMiles;
      }

      if (geoType === "neighborhood") {
        const eventNeighborhood = normalizeLower(event.venue_neighborhood);
        if (!eventNeighborhood) return false;
        const neighborhoods = collectStrings(payload, [], ["neighborhoods"], true);
        return neighborhoods.includes(eventNeighborhood);
      }

      return false;
    }
    default:
      return false;
  }
}

export function matchSubscribedChannelsToEvents(
  events: MatchableEvent[],
  channels: InterestChannelRow[],
  rules: InterestChannelRuleRow[],
): Map<number, EventChannelMatch[]> {
  if (events.length === 0 || channels.length === 0 || rules.length === 0) {
    return new Map();
  }

  const rulesByChannel = new Map<string, InterestChannelRuleRow[]>();
  for (const rule of rules) {
    if (!rule.is_active) continue;
    const existing = rulesByChannel.get(rule.channel_id);
    if (existing) {
      existing.push(rule);
    } else {
      rulesByChannel.set(rule.channel_id, [rule]);
    }
  }

  for (const channelRules of rulesByChannel.values()) {
    channelRules.sort((a, b) => a.priority - b.priority);
  }

  const sortedChannels = [...channels]
    .filter((channel) => channel.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const matchesByEventId = new Map<number, EventChannelMatch[]>();

  for (const event of events) {
    const matches: EventChannelMatch[] = [];

    for (const channel of sortedChannels) {
      const channelRules = rulesByChannel.get(channel.id);
      if (!channelRules || channelRules.length === 0) continue;

      const matchedRule = channelRules.find((rule) => ruleMatchesEvent(rule, event));
      if (!matchedRule) continue;

      matches.push({
        channel_id: channel.id,
        channel_slug: channel.slug,
        channel_name: channel.name,
        channel_type: channel.channel_type,
        matched_rule_type: matchedRule.rule_type,
      });
    }

    if (matches.length > 0) {
      matchesByEventId.set(event.id, matches);
    }
  }

  return matchesByEventId;
}

export async function getUserSubscribedChannelMatchesForEvents(
  supabase: AnySupabase,
  userId: string,
  events: MatchableEvent[],
  options?: {
    portalId?: string | null;
    includeUnscoped?: boolean;
  },
): Promise<EventChannelMatchResult> {
  if (!userId || events.length === 0) {
    return {
      matchesByEventId: new Map(),
      subscribedChannelCount: 0,
    };
  }

  const portalId = options?.portalId || null;
  const includeUnscoped = options?.includeUnscoped ?? true;

  let subscriptionsQuery = supabase
    .from("user_channel_subscriptions")
    .select("channel_id, portal_id")
    .eq("user_id", userId);

  const subscriptionPortalFilter = buildSubscriptionPortalFilter(
    portalId,
    includeUnscoped,
  );
  if (subscriptionPortalFilter) {
    subscriptionsQuery = subscriptionsQuery.or(subscriptionPortalFilter);
  }

  const { data: subscriptionsData } = await subscriptionsQuery;
  const subscriptions = (subscriptionsData || []) as UserChannelSubscriptionRow[];
  const subscribedChannelIds = [...new Set(subscriptions.map((s) => s.channel_id))];

  if (subscribedChannelIds.length === 0) {
    return {
      matchesByEventId: new Map(),
      subscribedChannelCount: 0,
    };
  }

  let channelsQuery = supabase
    .from("interest_channels")
    .select("id, portal_id, slug, name, channel_type, sort_order, is_active")
    .in("id", subscribedChannelIds)
    .eq("is_active", true);

  if (portalId && isValidUUID(portalId)) {
    channelsQuery = channelsQuery.or(`portal_id.eq.${portalId},portal_id.is.null`);
  }

  const { data: channelsData } = await channelsQuery;
  const channels = (channelsData || []) as InterestChannelRow[];

  if (channels.length === 0) {
    return {
      matchesByEventId: new Map(),
      subscribedChannelCount: 0,
    };
  }

  const activeChannelIds = channels.map((channel) => channel.id);
  const channelById = new Map(channels.map((channel) => [channel.id, channel]));
  const eventIds = [...new Set(events.map((event) => event.id))];
  const matchesByEventId = new Map<number, EventChannelMatch[]>();

  const canUsePrecomputed = Boolean(portalId && isValidUUID(portalId) && eventIds.length > 0);
  if (canUsePrecomputed) {
    const { data: precomputedData, error: precomputedError } = await supabase
      .from("event_channel_matches")
      .select("portal_id, event_id, channel_id, matched_rule_types, match_reasons, matched_at")
      .eq("portal_id", portalId as string)
      .in("event_id", eventIds)
      .in("channel_id", activeChannelIds);

    if (!precomputedError) {
      for (const row of (precomputedData || []) as EventChannelMatchRow[]) {
        const channel = channelById.get(row.channel_id);
        if (!channel) continue;

        const reasonType =
          (row.matched_rule_types || []).find((value) => typeof value === "string") ||
          "precomputed";

        const existing = matchesByEventId.get(row.event_id);
        const nextMatch: EventChannelMatch = {
          channel_id: channel.id,
          channel_slug: channel.slug,
          channel_name: channel.name,
          channel_type: channel.channel_type,
          matched_rule_type: reasonType,
        };
        if (existing) {
          existing.push(nextMatch);
        } else {
          matchesByEventId.set(row.event_id, [nextMatch]);
        }
      }
    }
  }

  const matchedEventIds = new Set(matchesByEventId.keys());
  const missingEvents = events.filter((event) => !matchedEventIds.has(event.id));

  if (missingEvents.length === 0) {
    return {
      matchesByEventId,
      subscribedChannelCount: channels.length,
    };
  }

  const { data: rulesData } = await supabase
    .from("interest_channel_rules")
    .select("channel_id, rule_type, rule_payload, priority, is_active")
    .in("channel_id", activeChannelIds)
    .eq("is_active", true);

  const rules = (rulesData || []) as InterestChannelRuleRow[];
  const computedMatches = matchSubscribedChannelsToEvents(missingEvents, channels, rules);

  for (const [eventId, matches] of computedMatches.entries()) {
    const existing = matchesByEventId.get(eventId);
    if (existing) {
      existing.push(...matches);
    } else {
      matchesByEventId.set(eventId, matches);
    }
  }

  return {
    matchesByEventId,
    subscribedChannelCount: channels.length,
  };
}

export async function refreshEventChannelMatchesForPortal(
  supabase: AnySupabase,
  portalId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    batchSize?: number;
    maxEvents?: number;
  },
): Promise<RefreshEventChannelMatchesResult> {
  if (!isValidUUID(portalId)) {
    throw new Error("Invalid portal id");
  }

  const startedAt = new Date();
  const startDate = options?.startDate || toIsoDateString(startedAt);
  const endDate =
    options?.endDate ||
    toIsoDateString(
      new Date(startedAt.getTime() + 120 * 24 * 60 * 60 * 1000),
    );
  const batchSize = Math.max(100, Math.min(options?.batchSize || 1000, 5000));

  const { data: channelsData } = await supabase
    .from("interest_channels")
    .select("id, portal_id, slug, name, channel_type, sort_order, is_active")
    .eq("is_active", true)
    .or(`portal_id.eq.${portalId},portal_id.is.null`);
  const channels = (channelsData || []) as InterestChannelRow[];

  if (channels.length === 0) {
    const { error: deleteError } = await supabase
      .from("event_channel_matches")
      .delete()
      .eq("portal_id", portalId);
    if (deleteError) {
      throw new Error(`Failed clearing stale matches: ${deleteError.message}`);
    }

    return {
      portalId,
      startDate,
      endDate,
      channelsConsidered: 0,
      eventsScanned: 0,
      matchesWritten: 0,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
    };
  }

  const channelIds = channels.map((channel) => channel.id);
  const { data: rulesData } = await supabase
    .from("interest_channel_rules")
    .select("channel_id, rule_type, rule_payload, priority, is_active")
    .in("channel_id", channelIds)
    .eq("is_active", true);
  const rules = (rulesData || []) as InterestChannelRuleRow[];

  if (rules.length === 0) {
    const { error: deleteError } = await supabase
      .from("event_channel_matches")
      .delete()
      .eq("portal_id", portalId);
    if (deleteError) {
      throw new Error(`Failed clearing stale matches: ${deleteError.message}`);
    }

    return {
      portalId,
      startDate,
      endDate,
      channelsConsidered: channels.length,
      eventsScanned: 0,
      matchesWritten: 0,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
    };
  }

  const events: MatchableEvent[] = [];
  let offset = 0;
  const accessibleSourceIds = await resolvePortalAccessibleSourceIds(supabase, portalId);
  if (accessibleSourceIds && accessibleSourceIds.length === 0) {
    const { error: deleteError } = await supabase
      .from("event_channel_matches")
      .delete()
      .eq("portal_id", portalId);
    if (deleteError) {
      throw new Error(`Failed clearing stale matches: ${deleteError.message}`);
    }

    return {
      portalId,
      startDate,
      endDate,
      channelsConsidered: channels.length,
      eventsScanned: 0,
      matchesWritten: 0,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
    };
  }
  let categoryColumn: "category" | "category_id" = "category";

  while (true) {
    const venueColumns = "venues(city, state, lat, lng, neighborhood)";
    const selectColumns = categoryColumn === "category"
      ? `id, source_id, organization_id, category, tags, venue_id, start_date, ${venueColumns}`
      : `id, source_id, organization_id, category_id, tags, venue_id, start_date, ${venueColumns}`;

    let query = supabase
      .from("events")
      .select(selectColumns)
      .gte("start_date", startDate)
      .lte("start_date", endDate)
      .is("canonical_event_id", null)
      .order("id", { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (accessibleSourceIds) {
      query = query.in("source_id", accessibleSourceIds);
    } else {
      query = query.or(`portal_id.eq.${portalId},portal_id.is.null`);
    }

    const { data: batchData, error } = await query;

    if (error) {
      if (
        categoryColumn === "category"
        && /column .*category.* does not exist/i.test(error.message)
      ) {
        categoryColumn = "category_id";
        continue;
      }
      throw new Error(`Failed loading events for match refresh: ${error.message}`);
    }

    const batch = (batchData || []) as unknown as Array<{
      id: number;
      source_id: number | null;
      organization_id: string | null;
      category: string | null;
      category_id?: string | null;
      tags: string[] | null;
      venue_id: number | null;
      venues: {
        city: string | null;
        state: string | null;
        lat: number | null;
        lng: number | null;
        neighborhood: string | null;
      } | null;
    }>;

    for (const row of batch) {
      events.push({
        id: row.id,
        source_id: row.source_id,
        organization_id: row.organization_id,
        category: normalizeEventCategoryValue(
          categoryColumn === "category" ? row.category : row.category_id,
        ),
        tags: row.tags,
        venue_id: row.venue_id,
        venue_city: row.venues?.city ?? null,
        venue_state: row.venues?.state ?? null,
        venue_lat: row.venues?.lat ?? null,
        venue_lng: row.venues?.lng ?? null,
        venue_neighborhood: row.venues?.neighborhood ?? null,
      });
    }

    if (batch.length < batchSize) break;
    offset += batchSize;

    if (options?.maxEvents && events.length >= options.maxEvents) {
      events.length = options.maxEvents;
      break;
    }
  }

  const matchesByEventId = matchSubscribedChannelsToEvents(events, channels, rules);

  const insertRows = Array.from(matchesByEventId.entries()).flatMap(
    ([eventId, eventMatches]) =>
      eventMatches.map((match) => ({
        portal_id: portalId,
        event_id: eventId,
        channel_id: match.channel_id,
        matched_rule_types: [match.matched_rule_type],
        match_reasons: {
          channel_slug: match.channel_slug,
          channel_name: match.channel_name,
          matched_rule_type: match.matched_rule_type,
        },
        matched_at: new Date().toISOString(),
      })),
  );

  // Replace previous materialization for this portal with fresh output.
  const { error: deleteError } = await supabase
    .from("event_channel_matches")
    .delete()
    .eq("portal_id", portalId);
  if (deleteError) {
    throw new Error(`Failed clearing stale matches: ${deleteError.message}`);
  }

  const insertBatchSize = 1000;
  for (let i = 0; i < insertRows.length; i += insertBatchSize) {
    const chunk = insertRows.slice(i, i + insertBatchSize);
    const { error } = await supabase.from("event_channel_matches").insert(chunk);
    if (error) {
      throw new Error(`Failed writing event channel matches: ${error.message}`);
    }
  }

  return {
    portalId,
    startDate,
    endDate,
    channelsConsidered: channels.length,
    eventsScanned: events.length,
    matchesWritten: insertRows.length,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
  };
}
