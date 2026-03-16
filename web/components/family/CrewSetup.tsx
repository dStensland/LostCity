"use client";

import { useState, useCallback, useEffect, memo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  KID_COLOR_PRESETS,
  SCHOOL_SYSTEMS,
  MAX_KIDS,
  type KidProfile,
  type CreateKidProfileRequest,
} from "@/lib/types/kid-profiles";
import { useAuthenticatedFetch } from "@/lib/hooks/useAuthenticatedFetch";
import { KID_PROFILES_QUERY_KEY } from "@/lib/hooks/useKidProfiles";

// Afternoon Field palette constants (light mode, no dark tokens)
const SAGE = "#5E7A5E";
const AMBER = "#C48B1D";
const CREAM_CANVAS = "#F0EDE4";
const DARK_FOREST = "#1E2820";
const WARM_STONE = "#756E63";
const CARD_SURFACE = "#FAFAF6";
const SKY = "#78B7D0";

// A small curated set of emoji for quick picking
const EMOJI_OPTIONS = ["🧒", "👦", "👧", "🧑", "🐣", "⭐", "🌻", "🦊", "🐼", "🦁", "🐬", "🦋", "🎈", "🚀"];

// Basic interest chips for kid profiles
const INTEREST_OPTIONS = [
  "Art", "Science", "Sports", "Music", "Reading",
  "Swimming", "Dance", "Drama", "Cooking", "Nature",
  "Coding", "Gaming", "Animals", "Building",
];

// ---- Sub-components -------------------------------------------------------

function FormLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
      style={{ color: WARM_STONE, fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}
    >
      {children}
    </label>
  );
}

function FormInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2.5 rounded-lg text-sm transition-colors focus:outline-none ${props.className ?? ""}`}
      style={{
        backgroundColor: CREAM_CANVAS,
        border: `1px solid ${WARM_STONE}35`,
        color: DARK_FOREST,
        ...(props.style ?? {}),
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = SAGE;
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = `${WARM_STONE}35`;
        props.onBlur?.(e);
      }}
    />
  );
}

// ---- Kid Card ---------------------------------------------------------------

interface KidCardProps {
  kid: KidProfile;
  onDelete: (id: string) => void;
  deleting: boolean;
}

function KidCard({ kid, onDelete, deleting }: KidCardProps) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl border"
      style={{
        backgroundColor: CARD_SURFACE,
        borderColor: `${kid.color}30`,
        borderLeftColor: kid.color,
        borderLeftWidth: 3,
      }}
    >
      {/* Color + emoji avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
        style={{ backgroundColor: `${kid.color}20`, border: `2px solid ${kid.color}50` }}
        aria-hidden="true"
      >
        {kid.emoji ?? kid.nickname.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug" style={{ color: DARK_FOREST }}>
          {kid.nickname}{" "}
          <span className="font-normal text-xs" style={{ color: WARM_STONE }}>
            age {kid.age}
          </span>
        </p>
        {kid.school_system && (
          <p className="text-xs mt-0.5" style={{ color: WARM_STONE }}>
            {SCHOOL_SYSTEMS.find((s) => s.value === kid.school_system)?.label ?? kid.school_system}
          </p>
        )}
        {kid.interests.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {kid.interests.slice(0, 4).map((interest) => (
              <span
                key={interest}
                className="px-1.5 py-0.5 rounded text-2xs"
                style={{ backgroundColor: `${kid.color}15`, color: kid.color }}
              >
                {interest}
              </span>
            ))}
            {kid.interests.length > 4 && (
              <span className="text-2xs" style={{ color: WARM_STONE }}>+{kid.interests.length - 4}</span>
            )}
          </div>
        )}
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={() => onDelete(kid.id)}
        disabled={deleting}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:opacity-70 disabled:opacity-40"
        style={{ color: WARM_STONE }}
        aria-label={`Remove ${kid.nickname}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}

// ---- Add Kid Form -----------------------------------------------------------

interface AddKidFormProps {
  onSave: (kid: CreateKidProfileRequest) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function AddKidForm({ onSave, onCancel, saving }: AddKidFormProps) {
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [color, setColor] = useState<string>(KID_COLOR_PRESETS[0].hex);
  const [emoji, setEmoji] = useState("");
  const [schoolSystem, setSchoolSystem] = useState<KidProfile["school_system"]>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nickname.trim()) {
      setError("Nickname is required.");
      return;
    }
    if (age === "" || age < 0 || age > 18) {
      setError("Age must be between 0 and 18.");
      return;
    }

    await onSave({
      nickname: nickname.trim(),
      age: Number(age),
      color,
      emoji: emoji || undefined,
      school_system: schoolSystem ?? undefined,
      interests,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border p-4 space-y-4 mt-3"
      style={{ backgroundColor: CARD_SURFACE, borderColor: `${SAGE}35` }}
    >
      <p
        className="text-sm font-semibold"
        style={{ color: DARK_FOREST, fontFamily: "var(--font-plus-jakarta-sans, system-ui, sans-serif)" }}
      >
        Add a kid
      </p>

      {error && (
        <div
          className="p-2.5 rounded-lg text-xs border"
          style={{ backgroundColor: "#E0707018", borderColor: "#E0707050", color: "#C55050" }}
        >
          {error}
        </div>
      )}

      {/* Row: nickname + age */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FormLabel>Nickname *</FormLabel>
          <FormInput
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Alex"
            maxLength={30}
            required
          />
        </div>
        <div>
          <FormLabel>Age *</FormLabel>
          <FormInput
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="0"
            min={0}
            max={18}
            required
          />
        </div>
      </div>

      {/* Color picker */}
      <div>
        <FormLabel>Color</FormLabel>
        <div className="flex flex-wrap gap-2">
          {KID_COLOR_PRESETS.map((preset) => (
            <button
              key={preset.hex}
              type="button"
              onClick={() => setColor(preset.hex)}
              className="w-8 h-8 rounded-full transition-transform hover:scale-110 active:scale-95"
              style={{
                backgroundColor: preset.hex,
                outline: color === preset.hex ? `3px solid ${preset.hex}` : "none",
                outlineOffset: 2,
                border: color === preset.hex ? "2px solid white" : "2px solid transparent",
              }}
              title={preset.name}
              aria-label={preset.name}
              aria-pressed={color === preset.hex}
            />
          ))}
        </div>
      </div>

      {/* Emoji picker */}
      <div>
        <FormLabel>Emoji (optional)</FormLabel>
        <div className="flex flex-wrap gap-2">
          {EMOJI_OPTIONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(emoji === e ? "" : e)}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-all hover:scale-110 active:scale-95 border"
              style={{
                backgroundColor: emoji === e ? `${color}20` : "transparent",
                borderColor: emoji === e ? `${color}60` : `${WARM_STONE}25`,
              }}
              aria-label={e}
              aria-pressed={emoji === e}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* School system */}
      <div>
        <FormLabel>School system (optional)</FormLabel>
        <select
          value={schoolSystem ?? ""}
          onChange={(e) =>
            setSchoolSystem(e.target.value === "" ? null : e.target.value as KidProfile["school_system"])
          }
          className="w-full px-3 py-2.5 rounded-lg text-sm transition-colors focus:outline-none appearance-none"
          style={{
            backgroundColor: CREAM_CANVAS,
            border: `1px solid ${WARM_STONE}35`,
            color: schoolSystem ? DARK_FOREST : WARM_STONE,
          }}
        >
          <option value="">Select a school system</option>
          {SCHOOL_SYSTEMS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Interests */}
      <div>
        <FormLabel>Interests (optional)</FormLabel>
        <div className="flex flex-wrap gap-1.5">
          {INTEREST_OPTIONS.map((interest) => {
            const active = interests.includes(interest);
            return (
              <button
                key={interest}
                type="button"
                onClick={() => toggleInterest(interest)}
                className="px-2.5 py-1 rounded-full text-xs font-medium border transition-all active:scale-95"
                style={
                  active
                    ? { backgroundColor: `${color}20`, borderColor: `${color}60`, color }
                    : { backgroundColor: "transparent", borderColor: `${WARM_STONE}30`, color: WARM_STONE }
                }
                aria-pressed={active}
              >
                {interest}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors hover:opacity-70"
          style={{ backgroundColor: `${WARM_STONE}15`, color: WARM_STONE, border: `1px solid ${WARM_STONE}25` }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 active:scale-[0.98]"
          style={{ backgroundColor: SAGE, color: "#fff" }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}

// ---- Main component --------------------------------------------------------

interface CrewSetupProps {
  /** Initial kids to display (server-fetched or empty). Component will refetch after mutations. */
  initialKids?: KidProfile[];
  /** Callback when crew changes (e.g. parent TodayView can re-filter). */
  onCrewChange?: (kids: KidProfile[]) => void;
  className?: string;
}

export const CrewSetup = memo(function CrewSetup({
  initialKids = [],
  onCrewChange,
  className = "",
}: CrewSetupProps) {
  const queryClient = useQueryClient();
  const { authFetch, user, isLoading: authLoading } = useAuthenticatedFetch();
  const [kids, setKids] = useState<KidProfile[]>(initialKids);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const canAddMore = kids.length < MAX_KIDS;

  useEffect(() => {
    setKids(initialKids);
  }, [initialKids]);

  const handleSaveKid = useCallback(
    async (req: CreateKidProfileRequest) => {
      setSaving(true);
      setFetchError(null);

      const { data, error } = await authFetch<{ kid: KidProfile }>("/api/user/kids", {
        method: "POST",
        body: req,
      });

      setSaving(false);

      if (error || !data) {
        setFetchError(error ?? "Failed to save. Please try again.");
        return;
      }

      const updated = [...kids, data.kid];
      setKids(updated);
      queryClient.setQueryData<KidProfile[]>(KID_PROFILES_QUERY_KEY, updated);
      onCrewChange?.(updated);
      setShowForm(false);
    },
    [authFetch, kids, onCrewChange, queryClient]
  );

  const handleDeleteKid = useCallback(
    async (id: string) => {
      setDeletingId(id);
      setFetchError(null);

      const { error } = await authFetch(`/api/user/kids/${id}`, {
        method: "DELETE",
      });

      setDeletingId(null);

      if (error) {
        setFetchError(error);
        return;
      }

      const updated = kids.filter((k) => k.id !== id);
      setKids(updated);
      queryClient.setQueryData<KidProfile[]>(KID_PROFILES_QUERY_KEY, updated);
      onCrewChange?.(updated);
    },
    [authFetch, kids, onCrewChange, queryClient]
  );

  if (authLoading) {
    return (
      <div className={`space-y-2 ${className}`}>
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-16 rounded-xl skeleton-shimmer-light"
          />
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <div
        className={`p-4 rounded-xl border text-sm text-center ${className}`}
        style={{ borderColor: `${WARM_STONE}30`, color: WARM_STONE }}
      >
        <a
          href="/auth/login"
          className="font-semibold underline hover:opacity-70 transition-opacity"
          style={{ color: SAGE }}
        >
          Sign in
        </a>{" "}
        to set up your crew and get personalized recommendations.
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Existing kids */}
      {kids.length > 0 && (
        <div className="space-y-2">
          {kids.map((kid) => (
            <KidCard
              key={kid.id}
              kid={kid}
              onDelete={handleDeleteKid}
              deleting={deletingId === kid.id}
            />
          ))}
        </div>
      )}

      {/* Error */}
      {fetchError && (
        <p className="text-xs px-1" style={{ color: "#C55050" }}>
          {fetchError}
        </p>
      )}

      {/* Inline add form */}
      {showForm && (
        <AddKidForm
          onSave={handleSaveKid}
          onCancel={() => setShowForm(false)}
          saving={saving}
        />
      )}

      {/* Add button */}
      {!showForm && canAddMore && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all hover:opacity-90 active:scale-[0.98]"
          style={{
            backgroundColor: SAGE,
            color: "#fff",
            fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          + Add a Kid
        </button>
      )}

      {/* Max kids reached */}
      {!canAddMore && (
        <p className="text-xs text-center" style={{ color: WARM_STONE }}>
          You&apos;ve added {MAX_KIDS} kids — that&apos;s the limit.
        </p>
      )}

      {/* Empty state when no kids and form not open */}
      {kids.length === 0 && !showForm && (
        <p className="text-xs text-center pt-1" style={{ color: WARM_STONE }}>
          Add your kids to get age-matched activity suggestions.
        </p>
      )}
    </div>
  );
});

export type { CrewSetupProps };
