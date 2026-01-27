import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
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

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = sanitizeKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  // During build time, env vars may not be available
  if (!supabaseUrl || !supabaseKey) {
    // Return a mock client during build to prevent errors
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null }),
            order: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
          }),
          order: () => ({
            limit: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createServerClient<Database>>;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}

// Get current user from server context
export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Get current session from server context
export async function getSession() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Get user profile with preferences
export async function getUserProfile() {
  const supabase = await createClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) {
      console.error("Error getting user in getUserProfile:", userError);
      return null;
    }

    if (!user) return null;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(`
        *,
        user_preferences(*)
      `)
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      // PGRST116 = "not found" - expected for new users before profile creation
      if (profileError.code !== "PGRST116") {
        console.error("Error fetching profile in getUserProfile:", profileError);
      }
      return null;
    }

    return profile;
  } catch (err) {
    console.error("Exception in getUserProfile:", err);
    return null;
  }
}

// Check if current user is an admin
export async function isAdmin(): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const profile = data as { is_admin: boolean } | null;
  return profile?.is_admin === true;
}

// Check if user owns or is admin of a portal
export async function canManagePortal(portalId: string): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;

  // Check if admin first
  if (await isAdmin()) return true;

  // Check if owner of portal
  const supabase = await createClient();
  const { data } = await supabase
    .from("portal_members")
    .select("role")
    .eq("portal_id", portalId)
    .eq("user_id", user.id)
    .maybeSingle();

  const member = data as { role: string } | null;
  return member?.role === "owner";
}
