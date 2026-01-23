"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import UnifiedHeader from "@/components/UnifiedHeader";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_GROUPS,
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
} from "@/lib/notification-types";

// Icon components
function NotificationIcon({ type, className = "" }: { type: string; className?: string }) {
  const icons: Record<string, React.ReactElement> = {
    clock: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    refresh: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    sparkles: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    users: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    "user-plus": (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
    mail: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    newspaper: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    ),
    megaphone: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
    lightbulb: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  };

  return icons[type] || icons.sparkles;
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load notification settings
  useEffect(() => {
    async function loadSettings() {
      if (!user) return;

      try {
        const { data } = await supabase
          .from("user_preferences")
          .select("notification_settings")
          .eq("user_id", user.id)
          .maybeSingle();

        const prefs = data as { notification_settings?: Record<string, boolean> } | null;
        if (prefs?.notification_settings) {
          setSettings({
            ...DEFAULT_NOTIFICATION_SETTINGS,
            ...(prefs.notification_settings as Partial<NotificationSettings>),
          });
        }
      } catch (err) {
        console.error("Error loading notification settings:", err);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      loadSettings();
    }
  }, [user, authLoading, supabase]);

  const updateSetting = async (key: keyof NotificationSettings, value: boolean) => {
    if (!user) return;

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setSaving(true);

    try {
      // First check if user preferences row exists
      const { data: existing } = await supabase
        .from("user_preferences")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        // Update existing - cast to any to bypass strict typing
        await (supabase
          .from("user_preferences") as ReturnType<typeof supabase.from>)
          .update({ notification_settings: newSettings } as never)
          .eq("user_id", user.id);
      } else {
        // Insert new
        await (supabase.from("user_preferences") as ReturnType<typeof supabase.from>)
          .insert({
            user_id: user.id,
            notification_settings: newSettings,
          } as never);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Error saving notification settings:", err);
      // Revert on error
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen">
        <UnifiedHeader />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-[var(--twilight)] rounded mb-8" />
            <div className="space-y-4">
              <div className="h-24 bg-[var(--twilight)] rounded-lg" />
              <div className="h-24 bg-[var(--twilight)] rounded-lg" />
              <div className="h-24 bg-[var(--twilight)] rounded-lg" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <UnifiedHeader />
        <main className="max-w-2xl mx-auto px-4 py-8 text-center">
          <p className="text-[var(--muted)]">Please sign in to manage notifications.</p>
          <Link href="/auth/login" className="mt-4 inline-block text-[var(--coral)]">
            Sign in
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <UnifiedHeader />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-2xl text-[var(--cream)] italic">
            Notifications
          </h1>
          {(saved || saving) && (
            <span className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
              saving
                ? "text-[var(--muted)] bg-[var(--twilight)]"
                : "text-[var(--neon-green)] bg-[var(--neon-green)]/10"
            }`}>
              {saving ? "Saving..." : "Saved"}
            </span>
          )}
        </div>

        <p className="font-mono text-sm text-[var(--muted)] mb-6">
          Choose which notifications you want to receive. We&apos;ll never spam you.
        </p>

        <div className="space-y-8">
          {Object.entries(NOTIFICATION_GROUPS).map(([groupKey, group]) => (
            <section key={groupKey}>
              <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">
                {group.label}
              </h2>

              <div className="space-y-3">
                {group.categories.map((categoryId) => {
                  const category = NOTIFICATION_CATEGORIES.find((c) => c.id === categoryId);
                  if (!category) return null;

                  const isEnabled = settings[categoryId as keyof NotificationSettings];

                  return (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)]"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 text-[var(--muted)]">
                          <NotificationIcon type={category.icon} className="w-5 h-5" />
                        </span>
                        <div>
                          <h3 className="font-mono text-sm font-medium text-[var(--cream)]">
                            {category.name}
                          </h3>
                          <p className="font-mono text-xs text-[var(--muted)] mt-0.5">
                            {category.description}
                          </p>
                          <div className="flex gap-1 mt-2">
                            {category.channels.map((channel) => (
                              <span
                                key={channel}
                                className="px-1.5 py-0.5 rounded text-[0.55rem] font-mono bg-[var(--twilight)] text-[var(--muted)]"
                              >
                                {channel === "push" ? "Push" : channel === "email" ? "Email" : "In-app"}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => updateSetting(category.id as keyof NotificationSettings, !isEnabled)}
                        className={`relative w-12 h-7 rounded-full transition-colors ${
                          isEnabled ? "bg-[var(--coral)]" : "bg-[var(--twilight)]"
                        }`}
                        aria-label={`${category.name} ${isEnabled ? "enabled" : "disabled"}`}
                      >
                        <span
                          className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                            isEnabled ? "left-6" : "left-1"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Back Link */}
        <div className="pt-8">
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Settings
          </Link>
        </div>
      </main>
    </div>
  );
}
