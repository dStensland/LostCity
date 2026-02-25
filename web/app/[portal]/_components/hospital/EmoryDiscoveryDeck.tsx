"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  EmoryFederationEventPreview,
  EmoryFederationOrgPreview,
  EmoryFederationVenuePreview,
} from "@/lib/emory-federation-showcase";
import {
  buildDiscoveryItems,
  groupEventItemsByDay,
  rankDiscoveryItems,
  type DiscoveryFilter,
  type DiscoverySort,
  type DiscoveryTab,
  type DiscoveryView,
} from "@/lib/emory-discovery";
import { getEventFallbackImage } from "@/lib/hospital-art";

const VenueMapExplorer = dynamic(() => import("./VenueMapExplorerInner"), {
  ssr: false,
  loading: () => (
    <div className="relative overflow-hidden rounded-lg border border-[#d7dce4] bg-[#f8f9fb] min-h-[320px]">
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-xs text-[#6b7280]">Loading map...</p>
      </div>
    </div>
  ),
});

type EmoryDiscoveryDeckProps = {
  stateKey?: string;
  events: EmoryFederationEventPreview[];
  venues: EmoryFederationVenuePreview[];
  organizations: EmoryFederationOrgPreview[];
  title: string;
  subtitle: string;
  defaultTab?: DiscoveryTab;
  emptyHref: string;
  quickFilters?: DiscoveryFilter[];
  contextParams?: Record<string, string | undefined>;
  allowedViews?: DiscoveryView[];
};

const DEFAULT_FILTERS: DiscoveryFilter[] = [
  { id: "all", label: "All", keywords: [] },
  { id: "family", label: "Family", keywords: ["family", "caregiver", "kids", "child"] },
  { id: "fitness", label: "Fitness", keywords: ["fitness", "walk", "movement", "yoga", "wellness"] },
  { id: "food", label: "Food access", keywords: ["food", "meal", "market", "nutrition", "kitchen", "cafe"] },
  { id: "care", label: "Care support", keywords: ["clinic", "screening", "pharmacy", "support", "health"] },
];

// Note: TAB_LABELS and VIEW_LABELS now come from useTranslations("discovery")

function getFallbackImage(item: { kind: string; title: string; subtitle: string }): string {
  if (item.kind === "event") return getEventFallbackImage(null, item.title);
  if (item.kind === "venue") return getEventFallbackImage(null, item.title);
  return getEventFallbackImage("community", item.title);
}

function appendContextParams(
  href: string,
  contextParams: Record<string, string | undefined> | undefined,
): string {
  if (!contextParams) return href;
  if (/^https?:\/\//i.test(href)) return href;

  const contextEntries = Object.entries(contextParams).filter(([, value]) => Boolean(value));
  if (contextEntries.length === 0) return href;

  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  for (const [key, value] of contextEntries) {
    if (!value) continue;
    if (!params.has(key)) params.set(key, value);
  }
  const nextQuery = params.toString();
  return nextQuery ? `${path}?${nextQuery}` : path;
}

function allowedSortsForTab(tab: DiscoveryTab): DiscoverySort[] {
  if (tab === "events") return ["relevant", "soonest", "alpha"];
  if (tab === "venues") return ["relevant", "closest", "active", "alpha"];
  return ["relevant", "active", "alpha"];
}

function parseSort(input: string | null, tab: DiscoveryTab): DiscoverySort {
  const valid = allowedSortsForTab(tab);
  if (input && valid.includes(input as DiscoverySort)) return input as DiscoverySort;
  return "relevant";
}

function readSavedPlan(storageKey: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

export default function EmoryDiscoveryDeck({
  stateKey,
  events,
  venues,
  organizations,
  title,
  subtitle,
  defaultTab = "events",
  emptyHref,
  quickFilters = DEFAULT_FILTERS,
  contextParams,
  allowedViews,
}: EmoryDiscoveryDeckProps) {
  const t = useTranslations("discovery");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const keyPrefix = stateKey || "discovery";

  const TAB_LABELS: Record<DiscoveryTab, string> = {
    events: t("tabEvents"),
    venues: t("tabVenues"),
    organizations: t("tabOrgs"),
  };

  const VIEW_LABELS: Record<DiscoveryView, string> = {
    list: t("viewList"),
    map: t("viewMap"),
    timeline: t("viewTimeline"),
  };

  const tabParam = searchParams.get(`${keyPrefix}_tab`) as DiscoveryTab | null;
  const viewParam = searchParams.get(`${keyPrefix}_view`) as DiscoveryView | null;
  const queryParam = searchParams.get(`${keyPrefix}_q`) || "";
  const filterParam = searchParams.get(`${keyPrefix}_filter`) || quickFilters[0]?.id || "all";

  const initialTab = tabParam && Object.keys(TAB_LABELS).includes(tabParam) ? tabParam : defaultTab;
  const initialView = viewParam && Object.keys(VIEW_LABELS).includes(viewParam) ? viewParam : "list";
  const storageKey = `emory-discovery-plan:${keyPrefix}`;

  const [activeTab, setActiveTab] = useState<DiscoveryTab>(initialTab);
  const [activeView, setActiveView] = useState<DiscoveryView>(initialView);
  const [query, setQuery] = useState(queryParam);
  const [activeFilter, setActiveFilter] = useState(filterParam);
  const [sort, setSort] = useState<DiscoverySort>(parseSort(searchParams.get(`${keyPrefix}_sort`), initialTab));
  const [savedIds, setSavedIds] = useState<string[]>(() => readSavedPlan(storageKey));
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const activeSort = allowedSortsForTab(activeTab).includes(sort) ? sort : "relevant";

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(savedIds));
    } catch {
      // Ignore storage write errors in constrained environments.
    }
  }, [savedIds, storageKey]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(`${keyPrefix}_tab`, activeTab);
    params.set(`${keyPrefix}_view`, activeView);
    if (query.trim()) params.set(`${keyPrefix}_q`, query.trim());
    else params.delete(`${keyPrefix}_q`);
    if (activeFilter) params.set(`${keyPrefix}_filter`, activeFilter);
    if (activeSort !== "relevant") params.set(`${keyPrefix}_sort`, activeSort);
    else params.delete(`${keyPrefix}_sort`);
    const nextQuery = params.toString();
    if (nextQuery !== searchParams.toString()) {
      router.replace(`${pathname}?${nextQuery}`, { scroll: false });
    }
  }, [activeTab, activeView, query, activeFilter, activeSort, pathname, router, searchParams, keyPrefix]);

  const visibleFilters = useMemo(
    () => quickFilters.filter((filter) => !filter.tabs || filter.tabs.includes(activeTab)),
    [quickFilters, activeTab],
  );

  const activeFilterDef = useMemo(
    () => quickFilters.find((filter) => filter.id === activeFilter) || quickFilters[0] || DEFAULT_FILTERS[0],
    [quickFilters, activeFilter],
  );

  const model = useMemo(
    () => buildDiscoveryItems({ events, venues, organizations }),
    [events, venues, organizations],
  );

  const rankedEvents = useMemo(
    () => rankDiscoveryItems({ items: model.events, now: new Date(), query, filter: activeFilterDef, sort: activeTab === "events" ? activeSort : "relevant" }),
    [model.events, query, activeFilterDef, activeSort, activeTab],
  );
  const rankedVenues = useMemo(
    () => rankDiscoveryItems({ items: model.venues, now: new Date(), query, filter: activeFilterDef, sort: activeTab === "venues" ? activeSort : "relevant" }),
    [model.venues, query, activeFilterDef, activeSort, activeTab],
  );
  const rankedOrgs = useMemo(
    () => rankDiscoveryItems({ items: model.organizations, now: new Date(), query, filter: activeFilterDef, sort: activeTab === "organizations" ? activeSort : "relevant" }),
    [model.organizations, query, activeFilterDef, activeSort, activeTab],
  );

  const activeItems = activeTab === "events" ? rankedEvents : activeTab === "venues" ? rankedVenues : rankedOrgs;
  const activeCount = activeItems.length;

  const allByKey = useMemo(() => {
    const map = new Map<string, { title: string; href: string; subtitle: string }>();
    [...model.events, ...model.venues, ...model.organizations].forEach((item) => {
      map.set(item.key, { title: item.title, href: item.detailHref, subtitle: item.subtitle });
    });
    return map;
  }, [model]);

  const savedItems = savedIds
    .map((id) => allByKey.get(id) ? { id, ...allByKey.get(id)! } : null)
    .filter((item): item is { id: string; title: string; href: string; subtitle: string } => Boolean(item));

  const timelineGroups = useMemo(() => groupEventItemsByDay(rankedEvents), [rankedEvents]);

  const toggleSaved = (id: string) => {
    setSavedIds((current) => (
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    ));
  };

  const handleTabChange = (tab: DiscoveryTab) => {
    setActiveTab(tab);
    if (!allowedSortsForTab(tab).includes(activeSort)) {
      setSort("relevant");
    }
    if (activeView === "timeline" && tab !== "events") {
      setActiveView("list");
    }
    if (activeView === "map" && tab !== "venues") {
      setActiveView("list");
    }
  };

  const handleViewChange = (view: DiscoveryView) => {
    if (view === "timeline" && activeTab !== "events") {
      setActiveTab("events");
    }
    if (view === "map" && activeTab !== "venues") {
      setActiveTab("venues");
    }
    setActiveView(view);
  };

  const resetControls = () => {
    setQuery("");
    setActiveFilter(quickFilters[0]?.id || "all");
    setSort("relevant");
    setActiveView("list");
  };

  return (
    <section className="rounded-xl border border-[#d7dce4] bg-white p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-xl sm:text-xl leading-[1.02] text-[#002f6c] font-semibold">{title}</h3>
          <p className="mt-1 text-xs sm:text-sm text-[#4b5563]">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsPlanOpen((value) => !value)}
            className="emory-secondary-btn inline-flex items-center px-2.5 py-1.5 text-xs"
          >
            {t("myPlan")} ({savedItems.length})
          </button>
          <span className="emory-chip">{activeCount} {t("results")}</span>
        </div>
      </div>

      {isPlanOpen && (
        <div className="mt-2 rounded-lg border border-[#d7dce4] bg-[#f8f9fb] p-2.5">
          {savedItems.length === 0 ? (
            <p className="text-xs text-[#6b7280]">{t("savePlanHint")}</p>
          ) : (
            <div className="space-y-1.5">
              {savedItems.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-2 rounded-lg border border-[#d7dce4] bg-white px-2.5 py-2">
                  <div>
                    <p className="text-sm font-semibold text-[#002f6c]">{item.title}</p>
                    <p className="text-xs text-[#4b5563]">{item.subtitle}</p>
                    <Link href={appendContextParams(item.href, contextParams)} className="emory-link-btn mt-0.5 inline-flex">{t("open")}</Link>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSaved(item.id)}
                    className="emory-link-btn"
                  >
                    {t("remove")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {(Object.keys(TAB_LABELS) as DiscoveryTab[]).map((tab) => {
          const active = tab === activeTab;
          const tabCount = tab === "events" ? rankedEvents.length : tab === "venues" ? rankedVenues.length : rankedOrgs.length;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={`emory-chip !normal-case !tracking-normal !text-[11px] ${active ? "!bg-[#eef4ff] !border-[#c2d4f1] !text-[#143b83]" : ""}`}
              aria-pressed={active}
            >
              {TAB_LABELS[tab]} ({tabCount})
            </button>
          );
        })}
      </div>

      <div id="discovery-list-fallback" className="mt-2 flex flex-wrap items-center gap-1.5">
        {(Object.keys(VIEW_LABELS) as DiscoveryView[]).filter((v) => !allowedViews || allowedViews.includes(v)).map((view) => {
          const disabled = (view === "timeline" && activeTab !== "events")
            || (view === "map" && activeTab !== "venues");
          const active = view === activeView;
          return (
            <button
              key={view}
              type="button"
              onClick={() => !disabled && handleViewChange(view)}
              disabled={disabled}
              className={`emory-chip !normal-case !tracking-normal !text-[11px] ${active ? "!bg-[#f2f8eb] !border-[#bde2b7] !text-[#205634]" : ""} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {VIEW_LABELS[view]}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {visibleFilters.map((filter) => {
          const active = filter.id === activeFilter;
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className={`emory-chip !normal-case !tracking-normal !text-[11px] ${active ? "!bg-[#f3f7ff] !border-[#c2d4f1] !text-[#143b83]" : ""}`}
              aria-pressed={active}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
        <label>
          <span className="sr-only">Search discovery results</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-md border border-[#d7dce4] bg-[#f8f9fb] px-3 py-2 text-sm text-[#002f6c] placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#bfd4f5]"
          />
        </label>
        <label>
          <span className="sr-only">Sort results</span>
          <select
            value={activeSort}
            onChange={(event) => setSort(event.target.value as DiscoverySort)}
            className="w-full rounded-md border border-[#d7dce4] bg-white px-2.5 py-2 text-sm text-[#002f6c]"
          >
            {allowedSortsForTab(activeTab).map((option) => (
              <option key={option} value={option}>
                {option === "relevant" ? t("sortRelevant") : option === "soonest" ? t("sortSoonest") : option === "closest" ? t("sortClosest") : option === "active" ? t("sortActive") : t("sortAlpha")}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={resetControls}
          className="emory-secondary-btn inline-flex items-center justify-center px-2.5 py-1.5 text-[11px] sm:px-3 sm:py-2 sm:text-xs"
        >
          {t("reset")}
        </button>
      </div>

      {activeView === "timeline" && activeTab === "events" && (
        <div className="mt-3 space-y-2">
          {timelineGroups.slice(0, 5).map((group) => (
            <section key={group.day} className="rounded-md border border-[#d7dce4] bg-[#f8f9fb] p-2.5">
              <p className="text-xs font-bold uppercase tracking-[0.05em] text-[#4b6a9b]">{group.day}</p>
              <div className="mt-1.5 space-y-1.5">
                {group.items.slice(0, 4).map((item) => (
                  <article key={item.key} className="rounded-lg border border-[#d7dce4] bg-white px-2.5 py-2 shadow-sm">
                    <div className="flex items-start gap-2.5">
                      <div className="h-12 w-14 overflow-hidden rounded border border-[#d7dce4] shrink-0">
                        <img src={item.imageUrl || getFallbackImage(item)} alt={item.title} className="h-full w-full object-cover" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#002f6c]">{item.title}</p>
                        <p className="text-xs text-[#4b5563]">{item.subtitle}</p>
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3">
                      <Link href={appendContextParams(item.detailHref, contextParams)} className="emory-link-btn">{t("viewDetails")}</Link>
                      <button type="button" onClick={() => toggleSaved(item.key)} className="emory-link-btn">
                        {savedIds.includes(item.key) ? t("saved") : t("save")}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {activeView === "map" && activeTab === "venues" && (
        <div className="mt-3">
          <a
            href="#discovery-list-fallback"
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:bg-white focus:px-3 focus:py-2 focus:rounded-md focus:shadow-lg focus:text-sm focus:font-semibold"
          >
            Skip map, switch to list view
          </a>
          <VenueMapExplorer
            items={rankedVenues}
            savedIds={savedIds}
            contextParams={contextParams}
            onToggleSaved={toggleSaved}
          />
        </div>
      )}

      {activeView !== "timeline" && !(activeView === "map" && activeTab === "venues") && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {activeItems.slice(0, activeView === "map" ? 9 : 9).map((item) => {
            const thumb = item.imageUrl || getFallbackImage(item);
            return (
              <article key={item.key} className="overflow-hidden rounded-xl border border-[#d7dce4] bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="h-32 w-full overflow-hidden">
                  <img src={thumb} alt={item.title} className="h-full w-full object-cover" />
                </div>
                <div className="p-3">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#8094b3]">{item.kind === "event" ? "Event" : item.kind === "venue" ? "Venue" : "Organization"}</p>
                  <p className="mt-0.5 text-[14px] font-semibold text-[#002f6c] leading-snug line-clamp-2">{item.title}</p>
                  <p className="mt-1 text-xs text-[#4b5563] line-clamp-2">{item.subtitle}</p>
                  <div className="mt-2.5 flex flex-wrap gap-3">
                    <Link href={appendContextParams(item.detailHref, contextParams)} className="emory-link-btn">{t("open")}</Link>
                    {item.mapsHref && (
                      <a href={item.mapsHref} target="_blank" rel="noreferrer" className="emory-link-btn">{t("mapDirections")}</a>
                    )}
                    <button type="button" onClick={() => toggleSaved(item.key)} className="emory-link-btn">
                      {savedIds.includes(item.key) ? t("saved") : t("save")}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {activeCount > 9 && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-[#6b7280]">{t("showingFirst", { count: 9 })}</p>
          <Link href={appendContextParams(emptyHref, contextParams)} className="emory-link-btn inline-flex">
            Open Full Listings
          </Link>
        </div>
      )}

      {activeCount === 0 && (
        <div className="mt-3 rounded-md border border-dashed border-[#d7dce4] bg-[#f8f9fb] p-3">
          <p className="text-sm text-[#6b7280]">{t("noMatches")}</p>
          <Link href={appendContextParams(emptyHref, contextParams)} className="emory-link-btn mt-1 inline-flex">{t("openFullListings")}</Link>
        </div>
      )}
    </section>
  );
}
