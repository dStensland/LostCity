import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Generate a username from user data.
 * Falls back to a truncated user ID if email is not available.
 */
export function generateUsername(user: User): string {
  const baseUsername =
    user.email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "") ||
    `user_${user.id.substring(0, 8)}`;
  return baseUsername.substring(0, 30);
}

/**
 * Ensure a user profile exists in the database.
 * Creates one with a generated username if it doesn't exist.
 * This is a safety net for cases where the database trigger didn't fire.
 */
export async function ensureUserProfile(
  user: User,
  serviceClient: SupabaseClient
): Promise<{ created: boolean; error?: string }> {
  // Check if profile exists
  const { data: existingProfile } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile) {
    return { created: false };
  }

  // Create profile if it doesn't exist
  const username = generateUsername(user);
  const { error } = await serviceClient.from("profiles").insert({
    id: user.id,
    username,
  } as never);

  if (error) {
    console.error("Error creating user profile:", error);
    return { created: false, error: error.message };
  }

  return { created: true };
}
