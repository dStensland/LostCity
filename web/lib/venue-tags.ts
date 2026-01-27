import { supabase } from "./supabase";
import { createServiceClient } from "./supabase/service";
import type {
  VenueTagDefinition,
  VenueTagSummary,
  VenueTagWithVote,
  VenueTagCategory,
} from "./types";

// Category display configuration
export const TAG_CATEGORIES: Record<VenueTagCategory, { label: string; color: string }> = {
  vibe: { label: "Vibes", color: "var(--neon-cyan)" },
  amenity: { label: "Amenities", color: "var(--sage)" },
  good_for: { label: "Good For", color: "var(--coral)" },
  food_drink: { label: "Food & Drink", color: "var(--gold)" },
  accessibility: { label: "Accessibility", color: "var(--lavender)" },
};

// Type helper for untyped tables (new tables not yet in generated types)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedTable = any;

/**
 * Get all active tag definitions for autocomplete
 */
export async function getAllTagDefinitions(): Promise<VenueTagDefinition[]> {
  const { data, error } = await (supabase as UntypedTable)
    .from("venue_tag_definitions")
    .select("*")
    .eq("is_active", true)
    .order("category")
    .order("label");

  if (error) {
    console.error("Error fetching tag definitions:", error);
    return [];
  }

  return data as VenueTagDefinition[];
}

/**
 * Get tag definitions grouped by category
 */
export async function getTagDefinitionsByCategory(): Promise<
  Record<VenueTagCategory, VenueTagDefinition[]>
> {
  const definitions = await getAllTagDefinitions();

  const grouped: Record<VenueTagCategory, VenueTagDefinition[]> = {
    vibe: [],
    amenity: [],
    good_for: [],
    food_drink: [],
    accessibility: [],
  };

  for (const def of definitions) {
    const category = def.category as VenueTagCategory;
    if (grouped[category]) {
      grouped[category].push(def);
    }
  }

  return grouped;
}

/**
 * Get tags for a specific venue with scores
 */
export async function getVenueTags(venueId: number): Promise<VenueTagSummary[]> {
  const { data, error } = await (supabase as UntypedTable)
    .from("venue_tag_summary")
    .select("*")
    .eq("venue_id", venueId)
    .order("score", { ascending: false });

  if (error) {
    console.error("Error fetching venue tags:", error);
    return [];
  }

  return data as VenueTagSummary[];
}

/**
 * Get tags for a venue with user's vote/add status
 */
export async function getVenueTagsWithUserStatus(
  venueId: number,
  userId: string | null
): Promise<VenueTagWithVote[]> {
  const tags = await getVenueTags(venueId);

  if (!userId) {
    return tags.map((t) => ({ ...t, user_vote: null, user_added: false }));
  }

  // Get user's votes
  const { data: votes } = await (supabase as UntypedTable)
    .from("venue_tag_votes")
    .select("venue_tag_id, vote_type")
    .eq("user_id", userId);

  // Get user's added tags
  const { data: userTags } = await (supabase as UntypedTable)
    .from("venue_tags")
    .select("tag_id")
    .eq("venue_id", venueId)
    .eq("added_by", userId);

  // We need to map venue_tag_id to tag_id through venue_tags
  const { data: venueTagMappings } = await (supabase as UntypedTable)
    .from("venue_tags")
    .select("id, tag_id")
    .eq("venue_id", venueId);

  type VoteRow = { venue_tag_id: string; vote_type: string };
  type MappingRow = { id: string; tag_id: string };
  type UserTagRow = { tag_id: string };

  const voteMap = new Map<string, "up" | "down">();
  if (votes && venueTagMappings) {
    const mappings = venueTagMappings as MappingRow[];
    const voteRows = votes as VoteRow[];

    for (const vote of voteRows) {
      const mapping = mappings.find((m) => m.id === vote.venue_tag_id);
      if (mapping) {
        voteMap.set(mapping.tag_id, vote.vote_type as "up" | "down");
      }
    }
  }

  const addedTagIds = new Set(
    (userTags as UserTagRow[] | null)?.map((t) => t.tag_id) || []
  );

  return tags.map((tag) => ({
    ...tag,
    user_vote: voteMap.get(tag.tag_id) || null,
    user_added: addedTagIds.has(tag.tag_id),
  }));
}

/**
 * Get top tags for multiple venues (for SpotCard display)
 */
export async function getTopTagsForVenues(
  venueIds: number[],
  limit = 3
): Promise<Map<number, VenueTagSummary[]>> {
  if (venueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await (supabase as UntypedTable)
    .from("venue_tag_summary")
    .select("*")
    .in("venue_id", venueIds)
    .gte("score", 3) // Only show tags with some engagement
    .order("score", { ascending: false });

  if (error) {
    console.error("Error fetching venue tags:", error);
    return new Map();
  }

  const result = new Map<number, VenueTagSummary[]>();

  for (const tag of data as VenueTagSummary[]) {
    const existing = result.get(tag.venue_id) || [];
    if (existing.length < limit) {
      existing.push(tag);
      result.set(tag.venue_id, existing);
    }
  }

  return result;
}

/**
 * Add a tag to a venue
 */
export async function addTagToVenue(
  venueId: number,
  tagId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  // Use service client to bypass RLS - auth is validated in API route
  let serviceClient;
  try {
    serviceClient = createServiceClient();
  } catch {
    return { success: false, error: "Service unavailable" };
  }

  const { error } = await (serviceClient as UntypedTable)
    .from("venue_tags")
    .insert({ venue_id: venueId, tag_id: tagId, added_by: userId });

  if (error) {
    if (error.code === "23505") {
      // Unique constraint violation - already added
      return { success: true };
    }
    console.error("Error adding tag:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Remove a tag from a venue (user's own tag)
 */
export async function removeTagFromVenue(
  venueId: number,
  tagId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  // Use service client to bypass RLS - auth is validated in API route
  let serviceClient;
  try {
    serviceClient = createServiceClient();
  } catch {
    return { success: false, error: "Service unavailable" };
  }

  const { error } = await (serviceClient as UntypedTable)
    .from("venue_tags")
    .delete()
    .eq("venue_id", venueId)
    .eq("tag_id", tagId)
    .eq("added_by", userId);

  if (error) {
    console.error("Error removing tag:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Vote on a tag
 */
export async function voteOnTag(
  venueId: number,
  tagId: string,
  userId: string,
  voteType: "up" | "down" | null
): Promise<{ success: boolean; error?: string }> {
  // Use service client to bypass RLS - auth is validated in API route
  let serviceClient;
  try {
    serviceClient = createServiceClient();
  } catch {
    return { success: false, error: "Service unavailable" };
  }

  // First, find the venue_tag record
  const { data: venueTags } = await (serviceClient as UntypedTable)
    .from("venue_tags")
    .select("id")
    .eq("venue_id", venueId)
    .eq("tag_id", tagId)
    .limit(1);

  type VenueTagRow = { id: string };
  const tags = venueTags as VenueTagRow[] | null;

  if (!tags || tags.length === 0) {
    return { success: false, error: "Tag not found on venue" };
  }

  const venueTagId = tags[0].id;

  if (voteType === null) {
    // Remove vote
    const { error } = await (serviceClient as UntypedTable)
      .from("venue_tag_votes")
      .delete()
      .eq("venue_tag_id", venueTagId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error removing vote:", error);
      return { success: false, error: error.message };
    }
  } else {
    // Upsert vote
    const { error } = await (serviceClient as UntypedTable)
      .from("venue_tag_votes")
      .upsert(
        { venue_tag_id: venueTagId, user_id: userId, vote_type: voteType },
        { onConflict: "venue_tag_id,user_id" }
      );

    if (error) {
      console.error("Error voting:", error);
      return { success: false, error: error.message };
    }
  }

  return { success: true };
}

/**
 * Suggest a new tag
 */
export async function suggestTag(
  venueId: number,
  label: string,
  category: VenueTagCategory,
  userId: string
): Promise<{ success: boolean; suggestionId?: string; error?: string }> {
  // Use service client to bypass RLS - auth is validated in API route
  let serviceClient;
  try {
    serviceClient = createServiceClient();
  } catch {
    return { success: false, error: "Service unavailable" };
  }

  const { data, error } = await (serviceClient as UntypedTable)
    .from("venue_tag_suggestions")
    .insert({
      venue_id: venueId,
      suggested_label: label,
      suggested_category: category,
      suggested_by: userId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error suggesting tag:", error);
    return { success: false, error: error.message };
  }

  return { success: true, suggestionId: (data as { id: string }).id };
}

/**
 * Get pending tag suggestions (admin only)
 */
export async function getPendingSuggestions(): Promise<
  Array<{
    id: string;
    venue_id: number;
    venue_name?: string;
    suggested_label: string;
    suggested_category: string;
    suggested_by: string;
    suggester_username?: string;
    created_at: string;
  }>
> {
  let serviceClient;
  try {
    serviceClient = createServiceClient();
  } catch {
    return [];
  }

  const { data, error } = await (serviceClient as UntypedTable)
    .from("venue_tag_suggestions")
    .select(`
      id,
      venue_id,
      suggested_label,
      suggested_category,
      suggested_by,
      created_at,
      venues(name),
      profiles(username)
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching suggestions:", error);
    return [];
  }

  type SuggestionRow = {
    id: string;
    venue_id: number;
    suggested_label: string;
    suggested_category: string;
    suggested_by: string;
    created_at: string;
    venues: { name: string } | null;
    profiles: { username: string } | null;
  };

  return ((data as SuggestionRow[]) || []).map((s) => ({
    id: s.id,
    venue_id: s.venue_id,
    venue_name: s.venues?.name,
    suggested_label: s.suggested_label,
    suggested_category: s.suggested_category,
    suggested_by: s.suggested_by,
    suggester_username: s.profiles?.username,
    created_at: s.created_at,
  }));
}

/**
 * Approve a tag suggestion (admin only)
 */
export async function approveSuggestion(
  suggestionId: string,
  adminId: string
): Promise<{ success: boolean; tagId?: string; error?: string }> {
  let serviceClient;
  try {
    serviceClient = createServiceClient();
  } catch {
    return { success: false, error: "Service unavailable" };
  }

  // Get the suggestion
  const { data: suggestion, error: fetchError } = await (serviceClient as UntypedTable)
    .from("venue_tag_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .single();

  type SuggestionData = {
    venue_id: number;
    suggested_label: string;
    suggested_category: string;
    suggested_by: string;
  };

  if (fetchError || !suggestion) {
    return { success: false, error: "Suggestion not found" };
  }

  const suggestionData = suggestion as SuggestionData;

  // Create the slug from the label
  const slug = suggestionData.suggested_label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Check if similar tag already exists
  const { data: existing } = await (serviceClient as UntypedTable)
    .from("venue_tag_definitions")
    .select("id")
    .eq("slug", slug)
    .single();

  let tagId: string;

  if (existing) {
    tagId = (existing as { id: string }).id;
  } else {
    // Create new tag definition
    const { data: newTag, error: createError } = await (serviceClient as UntypedTable)
      .from("venue_tag_definitions")
      .insert({
        slug,
        label: suggestionData.suggested_label,
        category: suggestionData.suggested_category,
        is_official: false,
        is_active: true,
        created_by: suggestionData.suggested_by,
      })
      .select("id")
      .single();

    if (createError || !newTag) {
      return { success: false, error: "Failed to create tag" };
    }

    tagId = (newTag as { id: string }).id;
  }

  // Update suggestion status
  const { error: updateError } = await (serviceClient as UntypedTable)
    .from("venue_tag_suggestions")
    .update({
      status: "approved",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", suggestionId);

  if (updateError) {
    return { success: false, error: "Failed to update suggestion" };
  }

  // Add the tag to the venue
  await (serviceClient as UntypedTable)
    .from("venue_tags")
    .insert({
      venue_id: suggestionData.venue_id,
      tag_id: tagId,
      added_by: suggestionData.suggested_by,
    });

  return { success: true, tagId };
}

/**
 * Reject a tag suggestion (admin only)
 */
export async function rejectSuggestion(
  suggestionId: string,
  adminId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  let serviceClient;
  try {
    serviceClient = createServiceClient();
  } catch {
    return { success: false, error: "Service unavailable" };
  }

  const { error } = await (serviceClient as UntypedTable)
    .from("venue_tag_suggestions")
    .update({
      status: "rejected",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason || null,
    })
    .eq("id", suggestionId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
