import { SupabaseClient } from "@supabase/supabase-js";

// Cache chain venue IDs for 5 minutes to avoid repeated queries
let cachedChainVenueIds: number[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Get IDs of all chain venues (is_chain = true).
 * Used by feed routes to filter chain venues from curated feeds.
 * Chain venues remain searchable and visible on maps.
 */
export async function getChainVenueIds(
  supabase: SupabaseClient
): Promise<number[]> {
  const now = Date.now();

  if (cachedChainVenueIds && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedChainVenueIds;
  }

  const { data, error } = await supabase
    .from("venues")
    .select("id")
    .eq("is_chain", true);

  if (error) {
    console.error("Failed to fetch chain venue IDs:", error);
    return cachedChainVenueIds || [];
  }

  cachedChainVenueIds = (data || []).map((v: { id: number }) => v.id);
  cacheTimestamp = now;

  return cachedChainVenueIds;
}
