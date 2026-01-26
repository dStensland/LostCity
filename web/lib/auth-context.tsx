"use client";

import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
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

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: Error | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  error: null,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);
  const profileFetchRef = useRef<string | null>(null);

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

  useEffect(() => {
    isMountedRef.current = true;
    let isCurrentEffect = true;

    const initAuth = async () => {
      try {
        // Use getUser() which validates the session with the server
        // This is more reliable than getSession() which only checks local storage
        const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();

        if (!isMountedRef.current || !isCurrentEffect) return;

        if (userError) {
          // PGRST116 or similar "not authenticated" errors are expected
          // Just means no valid session exists
          if (userError.message?.includes("Auth session missing")) {
            setLoading(false);
            return;
          }
          console.error("Error getting user:", userError);
        }

        if (authUser) {
          setUser(authUser);

          // Get session for completeness (already validated by getUser)
          const { data: { session: authSession } } = await supabase.auth.getSession();
          if (isMountedRef.current) {
            setSession(authSession);
          }

          // Fetch profile - don't block on this
          const userProfile = await fetchProfile(authUser.id);
          if (isMountedRef.current) {
            setProfile(userProfile);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        console.error("Auth init error:", err);
        if (isMountedRef.current && isCurrentEffect) {
          setError(err instanceof Error ? err : new Error("Auth initialization failed"));
        }
      } finally {
        if (isMountedRef.current && isCurrentEffect) {
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
        setLoading(false);
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        if (newSession?.user) {
          setUser(newSession.user);
          setSession(newSession);

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
      }
      setLoading(false);
    });

    return () => {
      isMountedRef.current = false;
      isCurrentEffect = false;
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
      window.location.href = "/";
    }
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
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
