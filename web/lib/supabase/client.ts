import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../types";

type BrowserClient = ReturnType<typeof createBrowserClient<Database>>;

const GLOBAL_CLIENT_KEY = "__lostcity_supabase_client__";

function getGlobalClient(): BrowserClient | null {
  if (typeof window === "undefined") return null;
  const globalScope = globalThis as typeof globalThis & {
    [GLOBAL_CLIENT_KEY]?: BrowserClient;
  };
  return globalScope[GLOBAL_CLIENT_KEY] ?? null;
}

function setGlobalClient(nextClient: BrowserClient) {
  if (typeof window === "undefined") return;
  const globalScope = globalThis as typeof globalThis & {
    [GLOBAL_CLIENT_KEY]?: BrowserClient;
  };
  globalScope[GLOBAL_CLIENT_KEY] = nextClient;
}

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

  const mockClient = {
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

  if (!supabaseUrl || !supabaseKey) {
    // Return a mock client during build to prevent errors
    // The real client will be created at runtime in the browser
    return mockClient;
  }

  // Only create the browser client in the browser runtime.
  // During SSR, return the mock to avoid instantiating multiple auth clients.
  if (typeof window === "undefined") {
    return mockClient;
  }

  const globalClient = getGlobalClient();
  if (globalClient) return globalClient;

  if (process.env.NODE_ENV === "development") {
    const globalScope = globalThis as typeof globalThis & {
      __lostcity_supabase_client_creations__?: number;
    };
    globalScope.__lostcity_supabase_client_creations__ =
      (globalScope.__lostcity_supabase_client_creations__ ?? 0) + 1;
    console.warn(
      `[Supabase] createBrowserClient #${globalScope.__lostcity_supabase_client_creations__}`,
      new Error("Supabase client created").stack
    );
  }

  const client = createBrowserClient<Database>(supabaseUrl, supabaseKey);
  setGlobalClient(client);
  return client;
}
