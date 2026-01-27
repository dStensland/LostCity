import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../types";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

// Aggressively sanitize API key - remove any whitespace, control chars, or URL encoding artifacts
function sanitizeKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  // Remove all whitespace (including \n, \r, \t), control characters, and decode any URL encoding
  return key
    .trim()
    .replace(/[\s\n\r\t]/g, '')  // Remove whitespace/newlines
    .replace(/%0A/gi, '')         // Remove URL-encoded newlines
    .replace(/%0D/gi, '')         // Remove URL-encoded carriage returns
    .replace(/[^\x20-\x7E]/g, ''); // Remove any non-printable ASCII
}

export function createClient() {
  // During build time, env vars may not be available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = sanitizeKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!supabaseUrl || !supabaseKey) {
    // Return a mock client during build to prevent errors
    // The real client will be created at runtime in the browser
    const mockChain = {
      select: () => mockChain,
      eq: () => mockChain,
      in: () => mockChain,
      single: async () => ({ data: null, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      update: () => mockChain,
      insert: () => mockChain,
      delete: () => mockChain,
      overlaps: () => mockChain,
    };
    return {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signOut: async () => ({ error: null }),
        signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
        signUp: async () => ({ data: { user: null, session: null }, error: null }),
        signInWithOAuth: async () => ({ data: { url: null }, error: null }),
        resetPasswordForEmail: async () => ({ data: {}, error: null }),
        updateUser: async () => ({ data: { user: null }, error: null }),
      },
      from: () => mockChain,
    } as unknown as ReturnType<typeof createBrowserClient<Database>>;
  }

  // Reuse existing client if available
  if (!client) {
    client = createBrowserClient<Database>(supabaseUrl, supabaseKey);
  }

  return client;
}
