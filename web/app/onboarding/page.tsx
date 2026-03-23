"use client";

import { useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MusicNote,
  Palette,
  SmileyWink,
  ForkKnife,
  Martini,
  Tree,
  Trophy,
  UsersThree,
  Baby,
  BookOpen,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth-context";

type Category = {
  id: string;
  label: string;
  Icon: Icon;
  color: string;
};

const CATEGORIES: Category[] = [
  { id: "music", label: "Music", Icon: MusicNote, color: "#FF6B7A" },
  { id: "art", label: "Art", Icon: Palette, color: "#A78BFA" },
  { id: "comedy", label: "Comedy", Icon: SmileyWink, color: "#FFD93D" },
  { id: "food_drink", label: "Food & Drink", Icon: ForkKnife, color: "#FF6B7A" },
  { id: "nightlife", label: "Nightlife", Icon: Martini, color: "#E855A0" },
  { id: "outdoors", label: "Outdoors", Icon: Tree, color: "#00D9A0" },
  { id: "sports", label: "Sports", Icon: Trophy, color: "#FFD93D" },
  { id: "community", label: "Community", Icon: UsersThree, color: "#00D4E8" },
  { id: "family", label: "Family", Icon: Baby, color: "#5E7A5E" },
  { id: "learning", label: "Learning", Icon: BookOpen, color: "#A78BFA" },
];

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runtimeSearch = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search);
  }, []);
  const portalSlug = searchParams.get("portal") ?? runtimeSearch?.get("portal");
  const { user, loading: authLoading } = useAuth();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const destination = portalSlug ? `/${portalSlug}` : "/atlanta";

  const handleContinue = async () => {
    if (selected.size === 0) return;
    if (!user) {
      router.push(destination);
      return;
    }

    setSaving(true);
    try {
      await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedCategories: Array.from(selected),
          selectedGenres: {},
          selectedNeeds: { accessibility: [], dietary: [], family: [] },
        }),
      });
    } catch (err) {
      console.error("Failed to save onboarding preferences:", err);
    } finally {
      setSaving(false);
    }

    router.push(destination);
  };

  const handleSkip = () => {
    router.push(destination);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--void)]">
        <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--void)]">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-[var(--cream)]">
          Make Lost City yours
        </h1>
        <p className="text-sm text-[var(--soft)] mt-2">
          Pick what interests you, or skip and explore everything
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-8">
          {CATEGORIES.map(({ id, label, Icon, color }) => {
            const isSelected = selected.has(id);
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                className={[
                  "rounded-card border p-4 cursor-pointer transition-all text-left",
                  isSelected
                    ? "border-2"
                    : "bg-[var(--night)] border-[var(--twilight)]",
                ].join(" ")}
                style={
                  isSelected
                    ? {
                        borderColor: color,
                        backgroundColor: `${color}1a`,
                      }
                    : undefined
                }
                aria-pressed={isSelected}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${color}33` }}
                >
                  <Icon size={32} weight="duotone" style={{ color }} />
                </div>
                <p className="text-sm font-semibold text-[var(--cream)] mt-2">
                  {label}
                </p>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleContinue}
          disabled={selected.size === 0 || saving}
          className="bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium py-3 px-6 rounded-lg w-full mt-8 transition-opacity disabled:opacity-40"
        >
          {saving ? "Saving…" : "Continue"}
        </button>

        <button
          onClick={handleSkip}
          className="text-sm text-[var(--soft)] hover:text-[var(--cream)] mt-3 text-center block w-full transition-colors"
        >
          Skip for now →
        </button>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--void)]">
          <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
