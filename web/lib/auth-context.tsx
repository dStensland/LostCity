"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
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

  const supabase = createClient();

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (fetchError) {
        console.error("Error fetching profile:", fetchError);
        // Don't set error state for "not found" - that's expected for new users
        if (fetchError.code !== "PGRST116") {
          throw new Error(`Profile fetch failed: ${fetchError.message}`);
        }
        return null;
      }

      return data as Profile;
    } catch (err) {
      console.error("Exception fetching profile:", err);
      throw err;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      try {
        const newProfile = await fetchProfile(user.id);
        if (isMountedRef.current) {
          setProfile(newProfile);
        }
      } catch (err) {
        console.error("Error refreshing profile:", err);
        if (isMountedRef.current) {
          setError(err instanceof Error ? err : new Error("Failed to refresh profile"));
        }
      }
    }
  };

  useEffect(() => {
    // Reset mounted ref on each effect run
    isMountedRef.current = true;

    // Use a local flag to prevent race conditions within this effect instance
    let isCurrentEffect = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        const {
          data: { session: initialSession },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!isMountedRef.current || !isCurrentEffect) return;

        if (sessionError) {
          console.error("Error getting session:", sessionError);
          setError(new Error(`Session error: ${sessionError.message}`));
          setLoading(false);
          return;
        }

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          try {
            const userProfile = await fetchProfile(initialSession.user.id);
            if (isMountedRef.current) {
              setProfile(userProfile);
            }
          } catch (profileErr) {
            // Profile fetch failed but session is valid - log but continue
            console.error("Profile fetch failed during init:", profileErr);
            if (isMountedRef.current) {
              setError(profileErr instanceof Error ? profileErr : new Error("Profile fetch failed"));
            }
          }
        }
      } catch (err) {
        // Ignore AbortError - expected during React StrictMode unmount/remount
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        console.error("Error getting initial session:", err);
        if (isMountedRef.current && isCurrentEffect) {
          setError(err instanceof Error ? err : new Error("Auth initialization failed"));
        }
      } finally {
        // Always set loading to false if this is the current effect and component is mounted
        if (isMountedRef.current && isCurrentEffect) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMountedRef.current) return;

      try {
        // Clear previous errors on auth state change
        setError(null);
        setSession(newSession);
        setUser(newSession?.user ?? null);

        // Handle session expiry - redirect to login if signed out unexpectedly
        if (event === "SIGNED_OUT" && !newSession) {
          setProfile(null);
          // Only redirect if we were previously signed in (not on initial load)
          // and not already on an auth page
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
            // Clear any stale state before redirect
            setLoading(false);
            return;
          }
        }

        // Handle token refresh errors
        if (event === "TOKEN_REFRESHED" && !newSession) {
          console.error("Token refresh failed - session expired");
          setProfile(null);
          // Redirect to login with return URL
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
            window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
            return;
          }
        }

        if (newSession?.user) {
          try {
            const userProfile = await fetchProfile(newSession.user.id);
            if (isMountedRef.current) {
              setProfile(userProfile);
            }
          } catch (profileErr) {
            console.error("Profile fetch failed on auth change:", profileErr);
            if (isMountedRef.current) {
              setError(profileErr instanceof Error ? profileErr : new Error("Profile fetch failed"));
            }
          }
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Error handling auth state change:", err);
        if (isMountedRef.current) {
          setError(err instanceof Error ? err : new Error("Auth state change failed"));
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    });

    return () => {
      isMountedRef.current = false;
      isCurrentEffect = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Run only on mount, supabase client is stable
  }, []);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Sign out error:", error);
      }
    } catch (err) {
      console.error("Sign out exception:", err);
    } finally {
      // Always clear local state and redirect, even if API call fails
      setUser(null);
      setSession(null);
      setProfile(null);
      // Redirect to home page
      window.location.href = "/";
    }
  };

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
