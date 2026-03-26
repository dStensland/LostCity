import { SupabaseClient } from "@supabase/supabase-js";

export function generateInviteCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function isSessionMember(serviceClient: SupabaseClient<any, any, any>, sessionId: number, userId: string): Promise<boolean> {
  const { data } = await serviceClient
    .from("goblin_session_members")
    .select("id")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .single();
  return !!data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function isSessionHost(serviceClient: SupabaseClient<any, any, any>, sessionId: number, userId: string): Promise<boolean> {
  const { data } = await serviceClient
    .from("goblin_session_members")
    .select("id")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .eq("role", "host")
    .single();
  return !!data;
}
