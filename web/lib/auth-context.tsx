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
  authState: AuthState;
  error: Error | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
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
  const [authState, setAuthState] = useState<AuthState>("initializing");
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);
  const profileFetchRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);

  const supabase = createClient();

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    // Prevent duplicate fetches for same user
    if (profileFetchRef.current === userId) {
      return profile;
    }
    profileFetchRef.current = userId;

    try {
      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (fetchError) {
        console.error("Error fetching profile:", fetchError);
        return null;
      }

      return data as Profile | null;
    } catch (err) {
      console.error("Exception fetching profile:", err);
      return null;
    }
  }, [supabase, profile]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      profileFetchRef.current = null; // Reset to allow refresh
      const newProfile = await fetchProfile(user.id);
      if (isMountedRef.current) {
        setProfile(newProfile);
      }
    }
  }, [user, fetchProfile]);

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
    let isCurrentEffect = true;

    // Skip if already initialized (prevents re-init on hot reload)
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    const initAuth = async () => {
      try {
        setAuthState("checking");

        // Try to get session - if it fails, retry once after a short delay
        // This handles the case where cookies aren't immediately available after OAuth redirect
        let session = null;
        let attempts = 0;
        const maxAttempts = 2;

        while (!session && attempts < maxAttempts) {
          const { data } = await supabase.auth.getSession();
          session = data.session;

          if (!session && attempts < maxAttempts - 1) {
            // Wait a bit and retry - cookies might not be synced yet
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          attempts++;
        }

        if (!isMountedRef.current || !isCurrentEffect) return;

        if (session?.user) {
          setUser(session.user);
          setSession(session);
          currentUserIdRef.current = session.user.id;
          setAuthState("authenticated");
          setLoading(false);

          // Fetch profile in parallel (don't block)
          fetchProfile(session.user.id).then((userProfile) => {
            if (isMountedRef.current) {
              setProfile(userProfile);
            }
          });
        } else {
          // No session - user is not logged in
          setAuthState("unauthenticated");
          setLoading(false);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        console.error("Auth init error:", err);
        if (isMountedRef.current && isCurrentEffect) {
          setError(err instanceof Error ? err : new Error("Auth initialization failed"));
          setAuthState("unauthenticated");
          setLoading(false);
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
          setUser(newSession.user);
          setSession(newSession);
          currentUserIdRef.current = newSession.user.id;
          setAuthState("authenticated");

          // Fetch profile for new session
          profileFetchRef.current = null; // Reset to allow new fetch
          const userProfile = await fetchProfile(newSession.user.id);
          if (isMountedRef.current) {
            setProfile(userProfile);
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
      isCurrentEffect = false;
      initializedRef.current = false; // Reset so remount can re-initialize
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
