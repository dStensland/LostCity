"use client";

import { memo, useState } from "react";
import { EyeSlash, Users, GlobeHemisphereWest } from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { PRIVACY_MODES } from "@/lib/types/profile";
import type { PrivacyMode } from "@/lib/types/profile";

// Map each mode to its Phosphor icon
const PRIVACY_ICONS: Record<PrivacyMode, PhosphorIcon> = {
  low_key: EyeSlash,
  social: Users,
  open_book: GlobeHemisphereWest,
};

interface PrivacyTierSelectorProps {
  /** Currently saved privacy mode */
  initialMode: PrivacyMode;
  /** Called after a successful PATCH — receives the newly saved mode */
  onSaved?: (mode: PrivacyMode) => void;
}

export const PrivacyTierSelector = memo(function PrivacyTierSelector({
  initialMode,
  onSaved,
}: PrivacyTierSelectorProps) {
  const [selected, setSelected] = useState<PrivacyMode>(initialMode);
  const [saving, setSaving] = useState(false);
  const [savedMode, setSavedMode] = useState<PrivacyMode>(initialMode);
  const [error, setError] = useState<string | null>(null);

  const isDirty = selected !== savedMode;

  const handleSelect = (mode: PrivacyMode) => {
    setSelected(mode);
    setError(null);
  };

  const handleSave = async () => {
    if (!isDirty || saving) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privacy_mode: selected }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to save privacy settings");
      }

      setSavedMode(selected);
      onSaved?.(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save privacy settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tier cards */}
      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(PRIVACY_MODES) as PrivacyMode[]).map((mode) => {
          const meta = PRIVACY_MODES[mode];
          const Icon = PRIVACY_ICONS[mode];
          const isActive = selected === mode;

          return (
            <button
              key={mode}
              type="button"
              onClick={() => handleSelect(mode)}
              aria-pressed={isActive}
              className={[
                "flex flex-col items-center gap-2 rounded-xl border p-4 text-center",
                "transition-colors focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-[var(--neon-green)] focus-visible:ring-offset-2",
                "focus-visible:ring-offset-[var(--night)]",
                isActive
                  ? "border-[var(--neon-green)] bg-[var(--neon-green)]/10"
                  : "border-[var(--twilight)] bg-[var(--night)] hover:border-[var(--soft)]/40",
              ].join(" ")}
            >
              <Icon
                size={20}
                className={isActive ? "text-[var(--neon-green)]" : "text-[var(--muted)]"}
              />
              <span
                className={[
                  "font-mono text-xs font-semibold uppercase tracking-wider",
                  isActive ? "text-[var(--neon-green)]" : "text-[var(--soft)]",
                ].join(" ")}
              >
                {meta.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Description card for the selected tier */}
      <div className="rounded-lg border border-[var(--twilight)] bg-[var(--dusk)] px-4 py-3">
        <p className="font-mono text-sm text-[var(--cream)]">
          {PRIVACY_MODES[selected].description}
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-[var(--coral)] bg-[var(--coral)]/10 px-4 py-3">
          <p className="font-mono text-xs text-[var(--coral)]">{error}</p>
        </div>
      )}

      {/* Save button — only visible when selection differs from last saved state */}
      {isDirty && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-lg bg-[var(--coral)] py-2.5 font-mono text-sm font-medium text-[var(--void)] transition-colors hover:bg-[var(--rose)] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Privacy Setting"}
        </button>
      )}
    </div>
  );
});

export type { PrivacyTierSelectorProps };
