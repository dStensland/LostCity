"use client";

import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  is_public: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

type AuthState = "initializing" | "authenticated" | "unauthenticated";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  authState: AuthState;
  error: Error | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

// BroadcastChannel for cross-tab sync
const PROFILE_SYNC_CHANNEL = "lostcity-profile-sync";

// Singleton Supabase client - created once per browser session
// This is the recommended pattern for client-side Supabase in Next.js
let supabaseClient: ReturnType<typeof createClient> | null = null;
function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient();
  }
  return supabaseClient;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  profileLoading: true,
  authState: "initializing",
  error: null,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [authState, setAuthState] = useState<AuthState>("initializing");
  const [error, setError] = useState<Error | null>(null);

  // Refs for tracking state across async operations
  const isMountedRef = useRef(true);
  const currentUserIdRef = useRef<string | null>(null);
  const profileFetchIdRef = useRef<number | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  const supabase = getSupabaseClient();

  // Set up cross-tab profile sync
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;

    const channel = new BroadcastChannel(PROFILE_SYNC_CHANNEL);
    broadcastChannelRef.current = channel;

    channel.onmessage = (event) => {
      const { type, profile: syncedProfile, userId } = event.data;

      // Only apply updates for the current user
      if (type === "PROFILE_UPDATED" && userId === currentUserIdRef.current && syncedProfile) {
        setProfile(syncedProfile);
      } else if (type === "SIGNED_OUT") {
        // Another tab signed out - invalidate any pending fetch and clear state
        profileFetchIdRef.current = null;
        setUser(null);
        setSession(null);
        setProfile(null);
        currentUserIdRef.current = null;
        setAuthState("unauthenticated");
        setProfileLoading(false);
      }
    };

    return () => {
      channel.close();
      broadcastChannelRef.current = null;
    };
  }, []);

  // Broadcast profile updates to other tabs
  const broadcastProfileUpdate = useCallback((updatedProfile: Profile | null, userId: string | null) => {
    if (broadcastChannelRef.current && userId) {
      broadcastChannelRef.current.postMessage({
        type: "PROFILE_UPDATED",
        profile: updatedProfile,
        userId,
      });
    }
  }, []);

  // Fetch profile via API - ensures profile exists and handles creation
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    // Track this fetch ID to detect if a newer fetch has started
    const fetchId = Date.now();
    profileFetchIdRef.current = fetchId;
    setProfileLoading(true);

    try {
      // Use API route to fetch/ensure profile exists
      const response = await fetch("/api/auth/profile", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      // Check if this fetch is still the current one
      if (profileFetchIdRef.current !== fetchId) {
        return null;
      }

      if (!response.ok) {
        console.error("Error fetching profile:", response.status);
        if (isMountedRef.current) setProfileLoading(false);
        return null;
      }

      const { profile: data } = await response.json();

      if (isMountedRef.current) setProfileLoading(false);
      return data as Profile | null;
    } catch (err) {
      console.error("Exception fetching profile:", err);
      if (isMountedRef.current) setProfileLoading(false);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const userId = currentUserIdRef.current;
    if (userId) {
      const newProfile = await fetchProfile(userId);
      if (isMountedRef.current && newProfile) {
        setProfile(newProfile);
        // Broadcast to other tabs
        broadcastProfileUpdate(newProfile, userId);
      }
    }
  }, [fetchProfile, broadcastProfileUpdate]);

  // Session refresh on tab focus - revalidate when user returns after being away
  useEffect(() => {
    let lastHiddenTime: number | null = null;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        lastHiddenTime = Date.now();
      } else if (lastHiddenTime && currentUserIdRef.current) {
        // Only revalidate if tab was hidden for more than 5 minutes
        const hiddenDuration = Date.now() - lastHiddenTime;
        if (hiddenDuration > 5 * 60 * 1000) {
          supabase.auth.getUser().then(({ data: { user: validatedUser }, error }) => {
            if (!isMountedRef.current) return;
            if (error || !validatedUser) {
              // Session expired during tab inactivity - clear state silently
              setUser(null);
              setSession(null);
              setProfile(null);
              currentUserIdRef.current = null;
              setAuthState("unauthenticated");
            }
          });
        }
        lastHiddenTime = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [supabase]);

  // Main auth initialization - relies solely on onAuthStateChange
  // This is the recommended Supabase pattern and avoids race conditions
  useEffect(() => {
    isMountedRef.current = true;

    // Helper to handle authenticated user
    const handleAuthenticatedUser = async (newSession: Session) => {
      const userId = newSession.user.id;
      const userChanged = currentUserIdRef.current !== userId;

      // Always update session (it may have refreshed tokens)
      setSession(newSession);

      if (userChanged) {
        // New user or first auth - update everything
        setUser(newSession.user);
        currentUserIdRef.current = userId;
        setAuthState("authenticated");
        setLoading(false);

        // Fetch profile (non-blocking for initial render)
        const userProfile = await fetchProfile(userId);
        if (isMountedRef.current && userProfile) {
          setProfile(userProfile);
        }
      } else {
        // Same user, just ensure loading is resolved
        setUser(newSession.user);
        setLoading(false);
      }
    };

    // Helper to handle unauthenticated state
    const handleUnauthenticated = () => {
      setUser(null);
      setSession(null);
      setProfile(null);
      currentUserIdRef.current = null;
      setAuthState("unauthenticated");
      setLoading(false);
      setProfileLoading(false);
    };

    // Set up auth state listener FIRST - this is key to avoiding race conditions
    // Supabase will fire INITIAL_SESSION immediately with current auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMountedRef.current) return;

      // Clear any previous errors
      setError(null);

      switch (event) {
        case "INITIAL_SESSION":
          // This fires immediately when the listener is set up
          // It contains the current session state from cookies/storage
          if (newSession?.user) {
            await handleAuthenticatedUser(newSession);
          } else {
            handleUnauthenticated();
          }
          break;

        case "SIGNED_IN":
          // User just signed in (OAuth redirect, email link, etc.)
          if (newSession?.user) {
            await handleAuthenticatedUser(newSession);
          }
          break;

        case "SIGNED_OUT":
          handleUnauthenticated();
          break;

        case "TOKEN_REFRESHED":
          // Session tokens were refreshed - verify user hasn't changed
          if (newSession?.user) {
            if (currentUserIdRef.current && newSession.user.id !== currentUserIdRef.current) {
              console.warn("Session user mismatch on token refresh - signing out");
              await supabase.auth.signOut();
              return;
            }
            // Update session with new tokens
            setSession(newSession);
            setUser(newSession.user);
          }
          break;

        case "USER_UPDATED":
          // User profile was updated (email, metadata, etc.)
          if (newSession?.user) {
            setUser(newSession.user);
            setSession(newSession);
          }
          break;

        default:
          // Handle any other events gracefully
          if (newSession?.user) {
            setUser(newSession.user);
            setSession(newSession);
          }
          break;
      }
    });

    return () => {
      isMountedRef.current = false;
      // Invalidate any pending profile fetch
      profileFetchIdRef.current = null;
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const signOut = useCallback(async () => {
    // Invalidate any pending profile fetch
    profileFetchIdRef.current = null;

    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      currentUserIdRef.current = null;
      setAuthState("unauthenticated");
      setProfileLoading(false);

      // Broadcast sign out to other tabs
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({ type: "SIGNED_OUT" });
      }

      // Use soft navigation to preserve React state
      router.push("/");
    }
  }, [supabase, router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        profileLoading,
        authState,
        error,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
