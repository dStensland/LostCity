import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types";

/**
 * Service-level Supabase client that bypasses RLS
 * Use ONLY for server-side operations that need to read all data
 * (e.g., aggregation queries for social proof counts)
 *
 * This client is safe to import in any file because it doesn't
 * use next/headers or other server-only imports.
 */

let _serviceClient: ReturnType<typeof createClient<Database>> | null = null;

export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Support both naming conventions for the service key
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing SUPABASE_SERVICE_KEY for service client");
    // Return a fallback that won't crash but returns empty results
    return {
      from: () => ({
        select: () => ({
          eq: () => ({ gte: () => ({ lte: () => ({ order: () => ({ limit: () => ({ data: null, error: new Error("Service client not configured") }) }) }) }) }),
          gte: () => ({ lte: () => ({ order: () => ({ limit: () => ({ data: null, error: new Error("Service client not configured") }) }) }) }),
          in: () => ({ data: null, error: new Error("Service client not configured") }),
          data: null,
          error: new Error("Service client not configured"),
        }),
      }),
    } as unknown as ReturnType<typeof createClient<Database>>;
  }

  if (!_serviceClient) {
    _serviceClient = createClient<Database>(supabaseUrl, supabaseServiceKey);
  }

  return _serviceClient;
}
