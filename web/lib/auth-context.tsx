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

type AuthState = "initializing" | "checking" | "authenticated" | "unauthenticated";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean; // Separate loading state for profile
  authState: AuthState;
  error: Error | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

// BroadcastChannel for cross-tab sync
const PROFILE_SYNC_CHANNEL = "lostcity-profile-sync";

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
  const isMountedRef = useRef(true);
  const profileFetchRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  const supabase = createClient();

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
        // Another tab signed out
        setUser(null);
        setSession(null);
        setProfile(null);
        profileFetchRef.current = null;
        currentUserIdRef.current = null;
        setAuthState("unauthenticated");
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

  const fetchProfile = useCallback(async (userId: string, forceRefresh = false): Promise<Profile | null> => {
    // Prevent duplicate fetches for same user (unless forced)
    if (!forceRefresh && profileFetchRef.current === userId) {
      return null; // Already fetching or fetched
    }
    profileFetchRef.current = userId;
    setProfileLoading(true);

    try {
      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (fetchError) {
        console.error("Error fetching profile:", fetchError);
        setProfileLoading(false);
        return null;
      }

      const fetchedProfile = data as Profile | null;
      setProfileLoading(false);
      return fetchedProfile;
    } catch (err) {
      console.error("Exception fetching profile:", err);
      setProfileLoading(false);
      return null;
    }
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const newProfile = await fetchProfile(user.id, true); // Force refresh
      if (isMountedRef.current) {
        setProfile(newProfile);
        // Broadcast to other tabs
        broadcastProfileUpdate(newProfile, user.id);
      }
    }
  }, [user, fetchProfile, broadcastProfileUpdate]);

  // Session refresh on tab focus - only revalidate when user returns after being away
  useEffect(() => {
    let lastHiddenTime: number | null = null;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        lastHiddenTime = Date.now();
      } else if (lastHiddenTime && user) {
        // Only revalidate if tab was hidden for more than 5 minutes
        const hiddenDuration = Date.now() - lastHiddenTime;
        if (hiddenDuration > 5 * 60 * 1000) {
          supabase.auth.getUser().then(({ data: { user: validatedUser }, error }) => {
            if (!isMountedRef.current) return;
            if (error || !validatedUser) {
              console.log("Session expired during tab inactivity");
              setUser(null);
              setSession(null);
              setProfile(null);
              profileFetchRef.current = null;
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
  }, [supabase, user]);

  useEffect(() => {
    isMountedRef.current = true;

    const initAuth = async () => {
      // Only do full init once, but always ensure loading state is resolved
      const isFirstInit = !initializedRef.current;
      initializedRef.current = true;

      try {
        if (isFirstInit) {
          setAuthState("checking");
        }

        // Always check session (needed for OAuth callback redirect)
        const { data } = await supabase.auth.getSession();
        const session = data.session;

        if (!isMountedRef.current) return;

        if (session?.user) {
          // Only update if user changed or first init
          if (isFirstInit || currentUserIdRef.current !== session.user.id) {
            setUser(session.user);
            setSession(session);
            currentUserIdRef.current = session.user.id;
            setAuthState("authenticated");

            // Fetch profile in parallel (don't block auth loading)
            fetchProfile(session.user.id).then((userProfile) => {
              if (isMountedRef.current) {
                setProfile(userProfile);
              }
            });
          }
          setLoading(false);
        } else {
          // No session - user is not logged in
          if (isFirstInit || currentUserIdRef.current !== null) {
            setUser(null);
            setSession(null);
            setProfile(null);
            currentUserIdRef.current = null;
            setAuthState("unauthenticated");
            setProfileLoading(false);
          }
          setLoading(false);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        console.error("Auth init error:", err);
        if (isMountedRef.current) {
          setError(err instanceof Error ? err : new Error("Auth initialization failed"));
          setAuthState("unauthenticated");
          setLoading(false);
          setProfileLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMountedRef.current) return;

      // Clear errors on any auth event
      setError(null);

      if (event === "SIGNED_OUT") {
        setUser(null);
        setSession(null);
        setProfile(null);
        profileFetchRef.current = null;
        currentUserIdRef.current = null;
        setAuthState("unauthenticated");
        setLoading(false);
        return;
      }

      if (event === "TOKEN_REFRESHED" && newSession?.user) {
        // Validate session hasn't been tampered with
        if (currentUserIdRef.current && newSession.user.id !== currentUserIdRef.current) {
          console.warn("Session user mismatch detected - signing out for security");
          await supabase.auth.signOut();
          return;
        }
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        if (newSession?.user) {
          // Only update if user actually changed (prevents race condition with initAuth)
          const userChanged = currentUserIdRef.current !== newSession.user.id;

          if (userChanged) {
            setUser(newSession.user);
            setSession(newSession);
            currentUserIdRef.current = newSession.user.id;
            setAuthState("authenticated");

            // Only fetch profile if user changed (not just re-firing the same session)
            profileFetchRef.current = null;
            const userProfile = await fetchProfile(newSession.user.id);
            if (isMountedRef.current) {
              setProfile(userProfile);
            }
          }
        }
        setLoading(false);
        return;
      }

      // For other events, just update state
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (!newSession?.user) {
        setProfile(null);
        profileFetchRef.current = null;
        currentUserIdRef.current = null;
        setAuthState("unauthenticated");
      }
      setLoading(false);
    });

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      profileFetchRef.current = null;
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
