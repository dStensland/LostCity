"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_GROUPS,
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
} from "@/lib/notification-types";
import { PushNotificationToggle } from "@/components/settings/PushNotificationToggle";

export default function NotificationsPanel() {
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
      const { data: existing } = await supabase
        .from("user_preferences")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await (supabase.from("user_preferences") as ReturnType<typeof supabase.from>)
          .update({ notification_settings: newSettings } as never)
          .eq("user_id", user.id);
      } else {
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
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-[var(--twilight)] rounded" />
        <div className="h-24 bg-[var(--twilight)] rounded-lg" />
        <div className="h-24 bg-[var(--twilight)] rounded-lg" />
        <div className="h-24 bg-[var(--twilight)] rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--cream)]">Notifications</h2>
          <p className="font-mono text-xs text-[var(--muted)] mt-1">
            Choose which notifications you want to receive.
          </p>
        </div>
        {(saved || saving) && (
          <span
            className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
              saving
                ? "text-[var(--muted)] bg-[var(--twilight)]"
                : "text-[var(--neon-green)] bg-[var(--neon-green)]/10"
            }`}
          >
            {saving ? "Saving..." : "Saved"}
          </span>
        )}
      </div>

      <PushNotificationToggle />

      <div className="space-y-8">
        {Object.entries(NOTIFICATION_GROUPS).map(([groupKey, group]) => (
          <section key={groupKey}>
            <h3 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">
              {group.label}
            </h3>

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
                    <div>
                      <h4 className="font-mono text-sm font-medium text-[var(--cream)]">
                        {category.name}
                      </h4>
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
                    <button
                      onClick={() => updateSetting(category.id as keyof NotificationSettings, !isEnabled)}
                      className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
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
    </div>
  );
}
