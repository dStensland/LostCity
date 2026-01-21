import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types";

// Sanitize API key - remove any whitespace, control chars, or URL encoding artifacts
function sanitizeKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return key
    .trim()
    .replace(/[\s\n\r\t]/g, '')
    .replace(/%0A/gi, '')
    .replace(/%0D/gi, '')
    .replace(/[^\x20-\x7E]/g, '');
}

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  // Support both naming conventions for the service key
  const supabaseServiceKey = sanitizeKey(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !supabaseServiceKey) {
    // Throw error - callers should catch this and handle gracefully
    throw new Error("Missing SUPABASE_SERVICE_KEY for service client");
  }

  if (!_serviceClient) {
    _serviceClient = createClient<Database>(supabaseUrl, supabaseServiceKey);
  }

  return _serviceClient;
}
