"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import type { HospitalAudienceMode } from "@/lib/hospital-modes";
import HospitalTrackedLink from "@/app/[portal]/_components/hospital/HospitalTrackedLink";

type ConciergeMomentKey = "breakfast" | "lunch" | "dinner" | "late_night";
type ConciergePreferenceKey = "any" | "quick_grab" | "comfort" | "vegetarian" | "low_sodium" | "family_friendly";
type ConciergeCategoryKey = "all" | "food" | "lodging" | "essentials" | "services" | "fitness" | "escapes";
type ConciergeCategory = Exclude<ConciergeCategoryKey, "all">;

export type ConciergeExplorerItem = {
  id: string;
  title: string;
  summary: string;
  neighborhood: string | null;
  venueType: string | null;
  distanceMiles: number;
  isOpenNow: boolean;
  openLate: boolean;
  imageUrl: string | null;
  mapsHref: string;
  websiteHref: string | null;
  searchBlob: string;
  category: ConciergeCategory;
};

type EmoryConciergeFoodExplorerProps = {
  portalSlug: string;
  hospitalSlug: string;
  mode: HospitalAudienceMode;
  items: ConciergeExplorerItem[];
};

type MomentOption = {
  id: ConciergeMomentKey;
  label: string;
  keywords: string[];
};

type PreferenceOption = {
  id: ConciergePreferenceKey;
  label: string;
  keywords: string[];
};

type CategoryOption = {
  id: ConciergeCategoryKey;
  label: string;
};

const CATEGORY_OPTIONS: CategoryOption[] = [
  { id: "all", label: "All" },
  { id: "food", label: "Food" },
  { id: "lodging", label: "Lodging" },
  { id: "essentials", label: "Essentials" },
  { id: "services", label: "Services" },
  { id: "fitness", label: "Fitness" },
  { id: "escapes", label: "Escapes" },
];

const MOMENT_OPTIONS: MomentOption[] = [
  { id: "breakfast", label: "Breakfast now", keywords: ["breakfast", "coffee", "cafe", "bakery", "morning"] },
  { id: "lunch", label: "Lunch", keywords: ["lunch", "salad", "sandwich", "bowl", "grill", "market"] },
  { id: "dinner", label: "Dinner", keywords: ["dinner", "kitchen", "restaurant", "bistro", "meal"] },
  { id: "late_night", label: "Late-night", keywords: ["late", "overnight", "24/7", "pharmacy", "urgent"] },
];

const PREFERENCE_OPTIONS: PreferenceOption[] = [
  { id: "any", label: "Any", keywords: [] },
  { id: "quick_grab", label: "Quick grab", keywords: ["grab", "quick", "market", "coffee", "deli"] },
  { id: "comfort", label: "Comfort", keywords: ["comfort", "kitchen", "grill", "diner", "soup"] },
  { id: "vegetarian", label: "Vegetarian", keywords: ["vegetarian", "vegan", "salad", "plant"] },
  { id: "low_sodium", label: "Low-sodium", keywords: ["low sodium", "healthy", "wellness", "nutrition"] },
  { id: "family_friendly", label: "Family", keywords: ["family", "kids", "group", "quiet"] },
];

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalize(value: string | null | undefined): string {
  return (value || "").toLowerCase();
}

function getDefaultMoment(): ConciergeMomentKey {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 22) return "dinner";
  return "late_night";
}

function matchKeywords(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  return keywords.some((keyword) => text.includes(keyword));
}

function sortByUtility(a: ConciergeExplorerItem, b: ConciergeExplorerItem): number {
  const score = (item: ConciergeExplorerItem): number => {
    let utility = 0;
    if (item.isOpenNow) utility += 20;
    if (item.openLate) utility += 14;
    if (item.distanceMiles <= 0.5) utility += 16;
    else if (item.distanceMiles <= 1.0) utility += 12;
    else if (item.distanceMiles <= 2.0) utility += 8;
    else utility += 3;
    return utility;
  };
  return score(b) - score(a) || a.distanceMiles - b.distanceMiles || a.title.localeCompare(b.title);
}

export default function EmoryConciergeFoodExplorer({
  portalSlug,
  hospitalSlug,
  mode,
  items,
}: EmoryConciergeFoodExplorerProps) {
  const [activeCategory, setActiveCategory] = useState<ConciergeCategoryKey>("all");
  const [activeMoment, setActiveMoment] = useState<ConciergeMomentKey>(getDefaultMoment());
  const [activePreference, setActivePreference] = useState<ConciergePreferenceKey>("any");

  const activeMomentOption = MOMENT_OPTIONS.find((option) => option.id === activeMoment) || MOMENT_OPTIONS[0];
  const activePreferenceOption = PREFERENCE_OPTIONS.find((option) => option.id === activePreference) || PREFERENCE_OPTIONS[0];
  const activeCategoryIsFood = activeCategory === "food";
  const activeCategoryLabel = CATEGORY_OPTIONS.find((option) => option.id === activeCategory)?.label || "All";

  const filtered = useMemo(() => {
    const list = items.filter((item) => {
      if (activeCategory !== "all" && item.category !== activeCategory) {
        return false;
      }

      const search = normalize(`${item.title} ${item.summary} ${item.neighborhood} ${item.venueType} ${item.searchBlob}`);

      if (activeCategoryIsFood) {
        if (activeMoment === "late_night") {
          if (!(item.openLate || search.includes("late") || search.includes("24/7") || search.includes("pharmacy"))) {
            return false;
          }
        } else if (!matchKeywords(search, activeMomentOption.keywords)) {
          return false;
        }

        if (!matchKeywords(search, activePreferenceOption.keywords)) {
          return false;
        }
      }

      return true;
    });

    return list.sort(sortByUtility).slice(0, 9);
  }, [items, activeCategory, activeCategoryIsFood, activeMoment, activeMomentOption.keywords, activePreferenceOption.keywords]);

  const categoryCounts = useMemo(() => {
    return {
      food: items.filter((item) => item.category === "food").length,
      lodging: items.filter((item) => item.category === "lodging").length,
      essentials: items.filter((item) => item.category === "essentials").length,
      services: items.filter((item) => item.category === "services").length,
      fitness: items.filter((item) => item.category === "fitness").length,
      escapes: items.filter((item) => item.category === "escapes").length,
    };
  }, [items]);

  return (
    <section className="rounded-xl border border-[var(--twilight)] bg-white p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-[1.2rem] sm:text-[1.35rem] leading-[1.02] text-[var(--cream)]">What&apos;s nearby</h3>
          <p className="mt-1 text-xs sm:text-sm text-[var(--muted)]">
            Showing <strong>{activeCategoryLabel.toLowerCase()}</strong> around this campus.
            {activeCategoryIsFood ? ` ${activeMomentOption.label.toLowerCase()} · ${activePreferenceOption.label.toLowerCase()}.` : ""}
          </p>
        </div>
        <p className="text-xs text-[var(--muted)]">{filtered.length} results</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {CATEGORY_OPTIONS.map((option) => {
          const active = activeCategory === option.id;
          const count = option.id === "all"
            ? items.length
            : categoryCounts[option.id];
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setActiveCategory(option.id)}
              className={`emory-chip !normal-case !tracking-normal !text-[11px] ${active ? "!bg-[#eef4ff] !border-[#c2d4f1] !text-[#143b83]" : ""}`}
              aria-pressed={active}
            >
              {option.label} ({count})
            </button>
          );
        })}
      </div>

      {activeCategoryIsFood && (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {MOMENT_OPTIONS.map((option) => {
              const active = activeMoment === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setActiveMoment(option.id)}
                  className={`emory-chip !normal-case !tracking-normal !text-[11px] ${active ? "!bg-[#eef4ff] !border-[#c2d4f1] !text-[#143b83]" : ""}`}
                  aria-pressed={active}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {PREFERENCE_OPTIONS.map((option) => {
              const active = activePreference === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setActivePreference(option.id)}
                  className={`emory-chip !normal-case !tracking-normal !text-[11px] ${active ? "!bg-[#f2f8eb] !border-[#bde2b7] !text-[#205634]" : ""}`}
                  aria-pressed={active}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((item) => (
          <article key={item.id} className="overflow-hidden rounded-lg border border-[var(--twilight)] bg-white">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.title}
                className="h-36 w-full object-cover"
              />
            ) : (
              <div className="h-36 w-full bg-gradient-to-br from-[#e8ecf2] to-[#d7dce6]" />
            )}
            <div className="p-3">
              <p className="text-[11px] uppercase tracking-[0.06em] text-[#6b7280]">
                {formatLabel(item.category)} · {formatLabel(item.venueType || "service")} · {item.distanceMiles.toFixed(1)} mi
              </p>
              <h4 className="mt-1 text-[1.05rem] leading-[1.02] text-[var(--cream)] font-semibold">{item.title}</h4>
              <p className="mt-1 text-xs text-[var(--muted)]">{item.summary}</p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                {item.isOpenNow ? "Open now" : "Check hours"}
                {item.openLate ? " · Open late" : ""}
                {item.neighborhood ? ` · ${item.neighborhood}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <HospitalTrackedLink
                  href={item.mapsHref}
                  external
                  tracking={{
                    actionType: "resource_clicked",
                    portalSlug,
                    hospitalSlug,
                    modeContext: mode,
                    sectionKey: "v3_concierge_food_explorer",
                    targetKind: "venue_maps",
                    targetId: item.id,
                    targetLabel: item.title,
                    targetUrl: item.mapsHref,
                    metadata: {
                      moment: activeMoment,
                      preference: activePreference,
                    },
                  }}
                  className="emory-link-btn"
                >
                  Directions
                </HospitalTrackedLink>
                {item.websiteHref && (
                  <HospitalTrackedLink
                    href={item.websiteHref}
                    external
                    tracking={{
                      actionType: "resource_clicked",
                      portalSlug,
                      hospitalSlug,
                      modeContext: mode,
                      sectionKey: "v3_concierge_food_explorer",
                      targetKind: "venue_website",
                      targetId: item.id,
                      targetLabel: item.title,
                      targetUrl: item.websiteHref,
                      metadata: {
                        moment: activeMoment,
                        preference: activePreference,
                      },
                    }}
                    className="emory-link-btn"
                  >
                    View Details
                  </HospitalTrackedLink>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="mt-3 rounded-md border border-dashed border-[var(--twilight)] bg-[var(--surface-1)] p-3">
          <p className="text-sm text-[var(--muted)]">No direct matches. Try another moment or preference.</p>
        </div>
      )}
    </section>
  );
}
