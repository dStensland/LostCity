/**
 * Federation System - Source Access and Query Logic
 *
 * This module provides functions to query and filter events based on
 * the federated source system. Portals can own sources, share them with
 * category-level granularity, and subscribe to sources from other portals.
 */

import { supabase } from "@/lib/supabase";
import { createServiceClient } from "@/lib/supabase/service";

// Types for federation

export interface SourceAccess {
  sourceId: number;
  sourceName: string;
  accessibleCategories: string[] | null; // null = all categories
  accessType: "owner" | "global" | "subscription";
}

export interface PortalSourceAccess {
  sourceIds: number[];
  categoryConstraints: Map<number, string[] | null>;
  accessDetails: SourceAccess[];
}

export interface SharingRule {
  id: string;
  sourceId: number;
  ownerPortalId: string;
  shareScope: "all" | "selected" | "none";
  allowedCategories: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  subscriberPortalId: string;
  sourceId: number;
  subscriptionScope: "all" | "selected";
  subscribedCategories: string[] | null;
  isActive: boolean;
  createdAt: string;
}

export interface SourceWithOwnership {
  id: number;
  name: string;
  slug: string;
  url: string;
  sourceType: string;
  isActive: boolean;
  ownerPortalId: string | null;
  ownerPortal?: {
    id: string;
    slug: string;
    name: string;
  } | null;
  sharingRule?: SharingRule | null;
  subscriberCount?: number;
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get accessible sources for a portal using the materialized view.
 * This is the main function used by the search module.
 */
export async function getPortalSourceAccess(portalId: string): Promise<PortalSourceAccess> {
  // Type for the materialized view rows (not in generated types)
  type PortalSourceAccessRow = {
    source_id: number;
    source_name: string;
    accessible_categories: string[] | null;
    access_type: string;
  };

  const { data, error } = await supabase
    .from("portal_source_access")
    .select("source_id, source_name, accessible_categories, access_type")
    .eq("portal_id", portalId);

  if (error) {
    console.error("Error fetching portal source access:", error);
    return {
      sourceIds: [],
      categoryConstraints: new Map(),
      accessDetails: [],
    };
  }

  const rows = (data || []) as unknown as PortalSourceAccessRow[];
  const sourceIds: number[] = [];
  const categoryConstraints = new Map<number, string[] | null>();
  const accessDetails: SourceAccess[] = [];

  for (const row of rows) {
    sourceIds.push(row.source_id);
    categoryConstraints.set(row.source_id, row.accessible_categories);
    accessDetails.push({
      sourceId: row.source_id,
      sourceName: row.source_name,
      accessibleCategories: row.accessible_categories,
      accessType: row.access_type as "owner" | "global" | "subscription",
    });
  }

  return { sourceIds, categoryConstraints, accessDetails };
}

/**
 * Check if a portal can access events from a specific source and category.
 */
export async function canPortalAccessEvent(
  portalId: string,
  sourceId: number,
  categoryId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("portal_source_access")
    .select("accessible_categories")
    .eq("portal_id", portalId)
    .eq("source_id", sourceId)
    .maybeSingle();

  const row = data as { accessible_categories: string[] | null } | null;

  if (error || !row) {
    return false;
  }

  // null means all categories are accessible
  if (row.accessible_categories === null) {
    return true;
  }

  return row.accessible_categories.includes(categoryId);
}

/**
 * Get all sources with ownership information for admin UI.
 */
export async function getSourcesWithOwnership(): Promise<SourceWithOwnership[]> {
  const serviceClient = createServiceClient();

  // Type for source rows (owner_portal_id is a new column)
  type SourceRow = {
    id: number;
    name: string;
    slug: string;
    url: string;
    source_type: string;
    is_active: boolean;
    owner_portal_id: string | null;
    owner_portal: { id: string; slug: string; name: string } | null;
  };

  // Get sources with their owner portals
  const { data: sourcesData, error: sourcesError } = await serviceClient
    .from("sources")
    .select(`
      id,
      name,
      slug,
      url,
      source_type,
      is_active,
      owner_portal_id,
      owner_portal:portals!sources_owner_portal_id_fkey(id, slug, name)
    `)
    .order("name");

  if (sourcesError) {
    console.error("Error fetching sources with ownership:", sourcesError);
    return [];
  }

  const sources = (sourcesData || []) as unknown as SourceRow[];

  // Type for sharing rules (not in generated types)
  type SharingRuleRow = {
    id: string;
    source_id: number;
    owner_portal_id: string;
    share_scope: string;
    allowed_categories: string[] | null;
    created_at: string;
    updated_at: string;
  };

  // Get sharing rules for all sources
  const { data: sharingRulesData } = await serviceClient
    .from("source_sharing_rules")
    .select("*");

  const sharingRules = (sharingRulesData || []) as unknown as SharingRuleRow[];
  const sharingRulesMap = new Map<number, SharingRule>();
  for (const rule of sharingRules) {
    sharingRulesMap.set(rule.source_id, {
      id: rule.id,
      sourceId: rule.source_id,
      ownerPortalId: rule.owner_portal_id,
      shareScope: rule.share_scope as "all" | "selected" | "none",
      allowedCategories: rule.allowed_categories,
      createdAt: rule.created_at,
      updatedAt: rule.updated_at,
    });
  }

  // Type for subscription counts
  type SubscriptionRow = { source_id: number };

  // Get subscription counts for each source
  const { data: subscriptionCountsData } = await serviceClient
    .from("source_subscriptions")
    .select("source_id")
    .eq("is_active", true);

  const subscriptionCounts = (subscriptionCountsData || []) as unknown as SubscriptionRow[];
  const subCountMap = new Map<number, number>();
  for (const sub of subscriptionCounts) {
    subCountMap.set(sub.source_id, (subCountMap.get(sub.source_id) || 0) + 1);
  }

  return (sources || []).map((source) => ({
    id: source.id,
    name: source.name,
    slug: source.slug,
    url: source.url,
    sourceType: source.source_type,
    isActive: source.is_active,
    ownerPortalId: source.owner_portal_id,
    ownerPortal: source.owner_portal
      ? {
          id: (source.owner_portal as { id: string; slug: string; name: string }).id,
          slug: (source.owner_portal as { id: string; slug: string; name: string }).slug,
          name: (source.owner_portal as { id: string; slug: string; name: string }).name,
        }
      : null,
    sharingRule: sharingRulesMap.get(source.id) || null,
    subscriberCount: subCountMap.get(source.id) || 0,
  }));
}

/**
 * Get sources owned by a specific portal.
 */
export async function getPortalOwnedSources(portalId: string): Promise<SourceWithOwnership[]> {
  const serviceClient = createServiceClient();

  // Type for source rows
  type SourceRow = {
    id: number;
    name: string;
    slug: string;
    url: string;
    source_type: string;
    is_active: boolean;
    owner_portal_id: string | null;
  };

  // Type for sharing rules
  type SharingRuleRow = {
    id: string;
    source_id: number;
    owner_portal_id: string;
    share_scope: string;
    allowed_categories: string[] | null;
    created_at: string;
    updated_at: string;
  };

  // Type for subscription counts
  type SubscriptionRow = { source_id: number };

  const { data: sourcesData, error } = await serviceClient
    .from("sources")
    .select(`
      id,
      name,
      slug,
      url,
      source_type,
      is_active,
      owner_portal_id
    `)
    .eq("owner_portal_id", portalId)
    .order("name");

  if (error) {
    console.error("Error fetching portal owned sources:", error);
    return [];
  }

  const sources = (sourcesData || []) as unknown as SourceRow[];

  // Get sharing rules for these sources
  const sourceIds = sources.map((s) => s.id);
  const { data: sharingRulesData } = await serviceClient
    .from("source_sharing_rules")
    .select("*")
    .in("source_id", sourceIds);

  const sharingRules = (sharingRulesData || []) as unknown as SharingRuleRow[];
  const sharingRulesMap = new Map<number, SharingRule>();
  for (const rule of sharingRules) {
    sharingRulesMap.set(rule.source_id, {
      id: rule.id,
      sourceId: rule.source_id,
      ownerPortalId: rule.owner_portal_id,
      shareScope: rule.share_scope as "all" | "selected" | "none",
      allowedCategories: rule.allowed_categories,
      createdAt: rule.created_at,
      updatedAt: rule.updated_at,
    });
  }

  // Get subscription counts
  const { data: subscriptionCountsData } = await serviceClient
    .from("source_subscriptions")
    .select("source_id")
    .in("source_id", sourceIds)
    .eq("is_active", true);

  const subscriptionCounts = (subscriptionCountsData || []) as unknown as SubscriptionRow[];
  const subCountMap = new Map<number, number>();
  for (const sub of subscriptionCounts) {
    subCountMap.set(sub.source_id, (subCountMap.get(sub.source_id) || 0) + 1);
  }

  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    slug: source.slug,
    url: source.url,
    sourceType: source.source_type,
    isActive: source.is_active,
    ownerPortalId: source.owner_portal_id,
    sharingRule: sharingRulesMap.get(source.id) || null,
    subscriberCount: subCountMap.get(source.id) || 0,
  }));
}

/**
 * Get sources available for a portal to subscribe to.
 * These are sources shared by other portals that this portal hasn't subscribed to yet.
 */
export async function getAvailableSourcesToSubscribe(portalId: string): Promise<{
  source: SourceWithOwnership;
  sharingRule: SharingRule;
}[]> {
  const serviceClient = createServiceClient();

  // Type for shared source rows with joined source data
  type SharedSourceRow = {
    id: string;
    source_id: number;
    owner_portal_id: string;
    share_scope: string;
    allowed_categories: string[] | null;
    created_at: string;
    updated_at: string;
    source: {
      id: number;
      name: string;
      slug: string;
      url: string;
      source_type: string;
      is_active: boolean;
      owner_portal_id: string | null;
      owner_portal: { id: string; slug: string; name: string } | null;
    } | null;
  };

  // Type for existing subscriptions
  type ExistingSubscriptionRow = { source_id: number };

  // Get sources that are shared (have sharing rules with scope != 'none')
  const { data: sharedSourcesData, error } = await serviceClient
    .from("source_sharing_rules")
    .select(`
      *,
      source:sources!source_sharing_rules_source_id_fkey(
        id,
        name,
        slug,
        url,
        source_type,
        is_active,
        owner_portal_id,
        owner_portal:portals!sources_owner_portal_id_fkey(id, slug, name)
      )
    `)
    .neq("share_scope", "none")
    .neq("owner_portal_id", portalId);

  if (error) {
    console.error("Error fetching available sources:", error);
    return [];
  }

  const sharedSources = (sharedSourcesData || []) as unknown as SharedSourceRow[];

  // Get current subscriptions for this portal
  const { data: existingSubscriptionsData } = await serviceClient
    .from("source_subscriptions")
    .select("source_id")
    .eq("subscriber_portal_id", portalId)
    .eq("is_active", true);

  const existingSubscriptions = (existingSubscriptionsData || []) as unknown as ExistingSubscriptionRow[];
  const subscribedSourceIds = new Set(
    existingSubscriptions.map((s) => s.source_id)
  );

  // Filter out already subscribed sources
  return sharedSources
    .filter((item) => !subscribedSourceIds.has(item.source_id))
    .map((item) => ({
      source: {
        id: item.source?.id,
        name: item.source?.name,
        slug: item.source?.slug,
        url: item.source?.url,
        sourceType: item.source?.source_type,
        isActive: item.source?.is_active,
        ownerPortalId: item.source?.owner_portal_id,
        ownerPortal: item.source?.owner_portal
          ? {
              id: item.source.owner_portal.id,
              slug: item.source.owner_portal.slug,
              name: item.source.owner_portal.name,
            }
          : null,
      } as SourceWithOwnership,
      sharingRule: {
        id: item.id,
        sourceId: item.source_id,
        ownerPortalId: item.owner_portal_id,
        shareScope: item.share_scope as "all" | "selected" | "none",
        allowedCategories: item.allowed_categories,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      },
    }));
}

/**
 * Get active subscriptions for a portal.
 */
export async function getPortalSubscriptions(portalId: string): Promise<{
  subscription: Subscription;
  source: SourceWithOwnership;
  sharingRule: SharingRule | null;
}[]> {
  const serviceClient = createServiceClient();

  // Type for subscription rows with joined source data
  type SubscriptionRow = {
    id: string;
    subscriber_portal_id: string;
    source_id: number;
    subscription_scope: string;
    subscribed_categories: string[] | null;
    is_active: boolean;
    created_at: string;
    source: {
      id: number;
      name: string;
      slug: string;
      url: string;
      source_type: string;
      is_active: boolean;
      owner_portal_id: string | null;
      owner_portal: { id: string; slug: string; name: string } | null;
    } | null;
  };

  // Type for sharing rules
  type SharingRuleRow = {
    id: string;
    source_id: number;
    owner_portal_id: string;
    share_scope: string;
    allowed_categories: string[] | null;
    created_at: string;
    updated_at: string;
  };

  const { data: subscriptionsData, error } = await serviceClient
    .from("source_subscriptions")
    .select(`
      *,
      source:sources!source_subscriptions_source_id_fkey(
        id,
        name,
        slug,
        url,
        source_type,
        is_active,
        owner_portal_id,
        owner_portal:portals!sources_owner_portal_id_fkey(id, slug, name)
      )
    `)
    .eq("subscriber_portal_id", portalId)
    .eq("is_active", true);

  if (error) {
    console.error("Error fetching portal subscriptions:", error);
    return [];
  }

  const subscriptions = (subscriptionsData || []) as unknown as SubscriptionRow[];

  // Get sharing rules for subscribed sources
  const sourceIds = subscriptions.map((s) => s.source_id);
  const { data: sharingRulesData } = await serviceClient
    .from("source_sharing_rules")
    .select("*")
    .in("source_id", sourceIds);

  const sharingRules = (sharingRulesData || []) as unknown as SharingRuleRow[];
  const sharingRulesMap = new Map<number, SharingRule>();
  for (const rule of sharingRules) {
    sharingRulesMap.set(rule.source_id, {
      id: rule.id,
      sourceId: rule.source_id,
      ownerPortalId: rule.owner_portal_id,
      shareScope: rule.share_scope as "all" | "selected" | "none",
      allowedCategories: rule.allowed_categories,
      createdAt: rule.created_at,
      updatedAt: rule.updated_at,
    });
  }

  return subscriptions.map((sub) => ({
    subscription: {
      id: sub.id,
      subscriberPortalId: sub.subscriber_portal_id,
      sourceId: sub.source_id,
      subscriptionScope: sub.subscription_scope as "all" | "selected",
      subscribedCategories: sub.subscribed_categories,
      isActive: sub.is_active,
      createdAt: sub.created_at,
    },
    source: {
      id: sub.source?.id,
      name: sub.source?.name,
      slug: sub.source?.slug,
      url: sub.source?.url,
      sourceType: sub.source?.source_type,
      isActive: sub.source?.is_active,
      ownerPortalId: sub.source?.owner_portal_id,
      ownerPortal: sub.source?.owner_portal
        ? {
            id: sub.source.owner_portal.id,
            slug: sub.source.owner_portal.slug,
            name: sub.source.owner_portal.name,
          }
        : null,
    } as SourceWithOwnership,
    sharingRule: sharingRulesMap.get(sub.source_id) || null,
  }));
}

// ============================================================================
// MUTATION FUNCTIONS
// ============================================================================

/**
 * Update the owner of a source.
 */
export async function updateSourceOwnership(
  sourceId: number,
  ownerPortalId: string | null
): Promise<{ success: boolean; error?: string }> {
  const serviceClient = createServiceClient();

  // Use type assertion since owner_portal_id is a new column not in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (serviceClient as any)
    .from("sources")
    .update({ owner_portal_id: ownerPortalId })
    .eq("id", sourceId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Refresh the materialized view
  await serviceClient.rpc("refresh_portal_source_access");

  return { success: true };
}

/**
 * Create or update a sharing rule for a source.
 */
export async function upsertSharingRule(
  sourceId: number,
  ownerPortalId: string,
  shareScope: "all" | "selected" | "none",
  allowedCategories: string[] | null
): Promise<{ success: boolean; error?: string }> {
  const serviceClient = createServiceClient();

  // Use type assertion since source_sharing_rules is a new table not in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (serviceClient as any)
    .from("source_sharing_rules")
    .upsert(
      {
        source_id: sourceId,
        owner_portal_id: ownerPortalId,
        share_scope: shareScope,
        allowed_categories: shareScope === "selected" ? allowedCategories : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source_id" }
    );

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Create a new subscription.
 */
export async function createSubscription(
  subscriberPortalId: string,
  sourceId: number,
  subscriptionScope: "all" | "selected" = "all",
  subscribedCategories: string[] | null = null
): Promise<{ success: boolean; error?: string }> {
  const serviceClient = createServiceClient();

  // Use type assertion since source_subscriptions is a new table not in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (serviceClient as any)
    .from("source_subscriptions")
    .insert({
      subscriber_portal_id: subscriberPortalId,
      source_id: sourceId,
      subscription_scope: subscriptionScope,
      subscribed_categories: subscriptionScope === "selected" ? subscribedCategories : null,
      is_active: true,
    });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Update a subscription.
 */
export async function updateSubscription(
  subscriptionId: string,
  updates: {
    subscriptionScope?: "all" | "selected";
    subscribedCategories?: string[] | null;
    isActive?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const serviceClient = createServiceClient();

  const updateData: Record<string, unknown> = {};
  if (updates.subscriptionScope !== undefined) {
    updateData.subscription_scope = updates.subscriptionScope;
  }
  if (updates.subscribedCategories !== undefined) {
    updateData.subscribed_categories = updates.subscribedCategories;
  }
  if (updates.isActive !== undefined) {
    updateData.is_active = updates.isActive;
  }

  // Use type assertion since source_subscriptions is a new table not in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (serviceClient as any)
    .from("source_subscriptions")
    .update(updateData)
    .eq("id", subscriptionId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Delete a subscription.
 */
export async function deleteSubscription(
  subscriptionId: string
): Promise<{ success: boolean; error?: string }> {
  const serviceClient = createServiceClient();

  // Use type assertion since source_subscriptions is a new table not in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (serviceClient as any)
    .from("source_subscriptions")
    .delete()
    .eq("id", subscriptionId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================================================
// STATISTICS FUNCTIONS
// ============================================================================

export interface FederationStats {
  totalSources: number;
  sourcesWithOwners: number;
  globalSources: number;
  activeSharingRules: number;
  activeSubscriptions: number;
  portalsWithOwnedSources: number;
  portalsWithSubscriptions: number;
}

/**
 * Get federation system statistics for the dashboard.
 */
export async function getFederationStats(): Promise<FederationStats> {
  const serviceClient = createServiceClient();

  // Type definitions for query results from new tables/columns
  type OwnerRow = { owner_portal_id: string };
  type SubscriberRow = { subscriber_portal_id: string };

  // Use type assertion for queries involving new tables/columns
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = serviceClient as any;

  const [
    { count: totalSources },
    { count: sourcesWithOwners },
    { count: activeSharingRules },
    { count: activeSubscriptions },
    { data: ownersDataRaw },
    { data: subscribersDataRaw },
  ] = await Promise.all([
    client.from("sources").select("*", { count: "exact", head: true }).eq("is_active", true),
    client.from("sources").select("*", { count: "exact", head: true }).eq("is_active", true).not("owner_portal_id", "is", null),
    client.from("source_sharing_rules").select("*", { count: "exact", head: true }).neq("share_scope", "none"),
    client.from("source_subscriptions").select("*", { count: "exact", head: true }).eq("is_active", true),
    client.from("sources").select("owner_portal_id").eq("is_active", true).not("owner_portal_id", "is", null),
    client.from("source_subscriptions").select("subscriber_portal_id").eq("is_active", true),
  ]);

  const ownersData = (ownersDataRaw || []) as OwnerRow[];
  const subscribersData = (subscribersDataRaw || []) as SubscriberRow[];

  const uniqueOwners = new Set(ownersData.map((s) => s.owner_portal_id));
  const uniqueSubscribers = new Set(subscribersData.map((s) => s.subscriber_portal_id));

  return {
    totalSources: totalSources || 0,
    sourcesWithOwners: sourcesWithOwners || 0,
    globalSources: (totalSources || 0) - (sourcesWithOwners || 0),
    activeSharingRules: activeSharingRules || 0,
    activeSubscriptions: activeSubscriptions || 0,
    portalsWithOwnedSources: uniqueOwners.size,
    portalsWithSubscriptions: uniqueSubscribers.size,
  };
}

/**
 * Refresh the portal_source_access materialized view.
 * Should be called after any changes to sources, sharing rules, or subscriptions.
 */
export async function refreshPortalSourceAccess(): Promise<void> {
  const serviceClient = createServiceClient();
  await serviceClient.rpc("refresh_portal_source_access");
}
