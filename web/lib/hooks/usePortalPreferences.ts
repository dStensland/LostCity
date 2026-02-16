"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  type PortalPreferences,
  getLocalPreferences,
  saveLocalPreferences,
  clearLocalPreferences,
  createEmptyPreferences,
} from "@/lib/onboarding-utils";

type UsePortalPreferencesReturn = {
  preferences: PortalPreferences | null;
  loading: boolean;
  saving: boolean;
  needsOnboarding: boolean;
  savePreferences: (prefs: Partial<PortalPreferences>) => Promise<void>;
  completeOnboarding: (prefs: PortalPreferences) => Promise<void>;
};

export function usePortalPreferences(
  portalId: string,
  portalSlug: string
): UsePortalPreferencesReturn {
  const { user, loading: authLoading } = useAuth();
  const [preferences, setPreferences] = useState<PortalPreferences | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    if (authLoading) return;

    async function load() {
      setLoading(true);

      if (user) {
        // Authenticated: fetch from API
        try {
          const res = await fetch(`/api/portals/${portalSlug}/preferences`);
          if (res.ok) {
            const data = await res.json();
            if (data.preferences) {
              setPreferences(data.preferences);

              // If we have local prefs but now authenticated, migrate them
              const local = getLocalPreferences(portalId);
              if (local && !data.preferences.onboarding_completed_at) {
                await migrateLocalToServer(portalSlug, local);
                clearLocalPreferences(portalId);
              }

              setLoading(false);
              return;
            }
          }
        } catch {
          // Fall through to local
        }

        // Check if there are local prefs to migrate
        const local = getLocalPreferences(portalId);
        if (local) {
          await migrateLocalToServer(portalSlug, local);
          clearLocalPreferences(portalId);
          setPreferences(local);
          setLoading(false);
          return;
        }
      } else {
        // Anonymous: load from localStorage
        const local = getLocalPreferences(portalId);
        if (local) {
          setPreferences(local);
          setLoading(false);
          return;
        }
      }

      setPreferences(null);
      setLoading(false);
    }

    load();
  }, [user, authLoading, portalId, portalSlug]);

  const savePreferences = useCallback(
    async (updates: Partial<PortalPreferences>) => {
      setSaving(true);

      const merged: PortalPreferences = {
        ...(preferences || createEmptyPreferences()),
        ...updates,
      };

      // Optimistic update
      setPreferences(merged);

      if (user) {
        try {
          const res = await fetch(`/api/portals/${portalSlug}/preferences`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(merged),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.preferences) {
              setPreferences(data.preferences);
            }
          }
        } catch {
          // Revert on failure
          setPreferences(preferences);
        }
      } else {
        saveLocalPreferences(portalId, merged);
      }

      setSaving(false);
    },
    [user, preferences, portalId, portalSlug]
  );

  const completeOnboarding = useCallback(
    async (prefs: PortalPreferences) => {
      const completed: PortalPreferences = {
        ...prefs,
        onboarding_completed_at: new Date().toISOString(),
      };

      setSaving(true);
      setPreferences(completed);

      if (user) {
        try {
          await fetch(`/api/portals/${portalSlug}/preferences`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...completed,
              onboarding_completed_at: true, // signal to server to set timestamp
            }),
          });
        } catch {
          // Already saved locally as fallback
        }
      }

      // Always save to localStorage as backup
      saveLocalPreferences(portalId, completed);
      setSaving(false);
    },
    [user, portalId, portalSlug]
  );

  const needsOnboarding =
    !loading && (!preferences || !preferences.onboarding_completed_at);

  return {
    preferences,
    loading,
    saving,
    needsOnboarding,
    savePreferences,
    completeOnboarding,
  };
}

async function migrateLocalToServer(
  portalSlug: string,
  prefs: PortalPreferences
): Promise<void> {
  try {
    await fetch(`/api/portals/${portalSlug}/preferences`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...prefs,
        onboarding_completed_at: prefs.onboarding_completed_at ? true : undefined,
      }),
    });
  } catch {
    // Non-critical — local copy still exists
  }
}
