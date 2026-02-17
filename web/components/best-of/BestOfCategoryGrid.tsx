"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "@/components/SmartImage";
import { usePortal } from "@/lib/portal-context";
import { getCategoryColor, RANK_COLORS } from "@/lib/best-of";
import type { BestOfVenuePreview } from "@/lib/best-of";
import { TrendUp, Fire } from "@phosphor-icons/react/dist/ssr";
import { BEST_OF_ICONS, DEFAULT_BEST_OF_ICON } from "./best-of-icons";

type CategorySummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  voteCount: number;
  nominationCount: number;
  topVenues: BestOfVenuePreview[];
};

/** Format algorithm score as a compact display number */
function formatScore(score: number): string {
  if (score >= 1000) return `${(score / 1000).toFixed(1)}k`;
  return Math.round(score).toString();
}

/** Render a score bar segment — wider = higher score relative to max */
function ScoreBar({ score, maxScore, color }: { score: number; maxScore: number; color: string }) {
  const pct = maxScore > 0 ? Math.max(2, (score / maxScore) * 100) : 2;
  return (
    <div className="h-[3px] rounded-full overflow-hidden" style={{ background: `${color}15`, width: "100%" }}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}, ${color}90)`,
          boxShadow: `0 0 4px ${color}40`,
        }}
      />
    </div>
  );
}

export default function BestOfCategoryGrid() {
  const { portal } = usePortal();
  const router = useRouter();
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchCategories = async () => {
      try {
        const res = await fetch(`/api/best-of?portal=${portal?.slug ?? "atlanta"}`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setCategories(data.categories ?? []);
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchCategories();
    return () => { cancelled = true; };
  }, [portal?.slug]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 skeleton-shimmer rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[180px] skeleton-shimmer rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--muted)] text-sm">No categories available yet</p>
      </div>
    );
  }

  const portalSlug = portal?.slug ?? "atlanta";
  const portalName = portal?.name ?? "Atlanta";

  const featuredCategories = categories.slice(0, 2);
  const standardCategories = categories.slice(2);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3
          className="text-xl sm:text-2xl font-bold tracking-tight"
          style={{
            color: "#C1D32F",
            textShadow: "0 0 7px rgba(193,211,47,0.5), 0 0 20px rgba(193,211,47,0.2)",
          }}
        >
          Best Of {portalName}
        </h3>
        <span className="text-[11px] font-mono text-[var(--muted)] uppercase tracking-[0.14em]">
          Community-ranked
        </span>
      </div>

      {/* Editorial magazine grid layout */}
      <div className="space-y-3">
        {/* Featured categories — first 2 */}
        {featuredCategories.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {featuredCategories.map((cat, idx) => (
              <FeaturedCard
                key={cat.id}
                cat={cat}
                idx={idx}
                portalSlug={portalSlug}
                router={router}
              />
            ))}
          </div>
        )}

        {/* Standard categories — remaining 8 in 2-col grid */}
        {standardCategories.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {standardCategories.map((cat, idx) => (
              <StandardCard
                key={cat.id}
                cat={cat}
                idx={idx}
                portalSlug={portalSlug}
                router={router}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Featured Card — larger, with hero first-place treatment
// ============================================================================

function FeaturedCard({
  cat,
  idx,
  portalSlug,
  router,
}: {
  cat: CategorySummary;
  idx: number;
  portalSlug: string;
  router: ReturnType<typeof useRouter>;
}) {
  const accent = getCategoryColor(cat.slug);
  const IconComponent = BEST_OF_ICONS[cat.slug] ?? DEFAULT_BEST_OF_ICON;
  const topThree = cat.topVenues?.slice(0, 3) ?? [];
  const leader = topThree[0];
  const runnersUp = topThree.slice(1);
  const maxScore = leader?.score ?? 1;

  return (
    <button
      type="button"
      onClick={() => router.push(`/${portalSlug}/best-of/${cat.slug}`)}
      className="text-left explore-track-enter focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded-xl"
      style={{ animationDelay: `${idx * 80}ms`, outlineColor: accent }}
    >
      <div
        className="relative overflow-hidden rounded-xl p-4 h-[260px] sm:h-[280px] flex flex-col transition-all duration-200 hover:scale-[1.01] group"
        style={{
          background: "var(--night)",
          border: "1px solid var(--twilight)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = accent;
          e.currentTarget.style.boxShadow = `0 0 16px ${accent}20`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--twilight)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {/* Left accent bar */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{
            background: accent,
            boxShadow: `2px 0 8px ${accent}40`,
          }}
        />

        {/* Corner gradient glow */}
        <div
          className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-[0.08] pointer-events-none"
          style={{ background: accent }}
        />

        {/* Icon + category name */}
        <div className="relative z-10 flex items-start gap-3 mb-2">
          <IconComponent
            size={24}
            weight="light"
            className="icon-neon flex-shrink-0"
            style={{ color: accent }}
          />
          <div className="flex-1">
            <h4
              className="font-semibold text-base leading-tight tracking-tight"
              style={{
                color: accent,
                textShadow: `0 0 8px ${accent}50`,
              }}
            >
              {cat.name.replace("Best ", "").replace("The ", "")}
            </h4>
          </div>
        </div>

        {/* Description */}
        {cat.description && (
          <p className="relative z-10 text-sm leading-relaxed italic text-[var(--cream)] opacity-70 mb-3">
            {cat.description}
          </p>
        )}

        {/* First place — hero treatment */}
        {leader && (
          <div className="relative z-10 mb-2">
            <div className="flex items-center gap-2.5">
              {/* Gold rank badge */}
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-black flex-shrink-0"
                style={{
                  background: `${RANK_COLORS[1]}25`,
                  color: RANK_COLORS[1],
                  boxShadow: `0 0 8px ${RANK_COLORS[1]}30`,
                }}
              >
                1
              </span>
              {/* Thumbnail */}
              {leader.imageUrl ? (
                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 ring-1 ring-white/10">
                  <Image
                    src={leader.imageUrl}
                    alt={leader.name}
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div
                  className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
                  style={{ background: `${accent}15` }}
                >
                  <span className="text-[10px] font-mono font-bold" style={{ color: accent }}>
                    {leader.name.charAt(0)}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span className="text-sm text-[var(--cream)] font-semibold truncate block">
                  {leader.name}
                </span>
              </div>
              {/* Score + trending */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <TrendUp size={12} weight="bold" style={{ color: accent }} className="opacity-70" />
                <span className="text-[11px] font-mono font-bold" style={{ color: accent }}>
                  {formatScore(leader.score)}
                </span>
              </div>
            </div>
            {/* Score bar for leader */}
            <div className="mt-1.5 pl-[34px]">
              <ScoreBar score={leader.score} maxScore={maxScore} color={RANK_COLORS[1]} />
            </div>
          </div>
        )}

        {/* Runners up — compact */}
        {runnersUp.length > 0 && (
          <div className="relative z-10 space-y-1 mt-auto">
            {runnersUp.map((v, i) => {
              const rank = i + 2;
              const medalColor = rank === 2 ? RANK_COLORS[2] : RANK_COLORS[3];
              return (
                <div key={v.venueId} className="flex items-center gap-2">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-mono font-bold flex-shrink-0"
                    style={{
                      background: `${medalColor}20`,
                      color: medalColor,
                    }}
                  >
                    {rank}
                  </span>
                  {v.imageUrl ? (
                    <div className="w-5 h-5 rounded overflow-hidden flex-shrink-0 bg-white/5">
                      <Image
                        src={v.imageUrl}
                        alt={v.name}
                        width={20}
                        height={20}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div
                      className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center"
                      style={{ background: `${accent}10` }}
                    >
                      <span className="text-[7px] font-mono font-bold" style={{ color: accent }}>
                        {v.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <span className="text-xs text-[var(--cream)] font-medium truncate flex-1 opacity-80">
                    {v.name}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--muted)] flex-shrink-0">
                    {formatScore(v.score)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Vote count pill */}
        <div className="relative z-10 mt-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono backdrop-blur-sm"
            style={{
              background: `${accent}12`,
              border: `1px solid ${accent}25`,
              color: accent,
            }}
          >
            {cat.voteCount > 0 && <Fire size={11} weight="fill" />}
            {cat.voteCount > 0
              ? `${cat.voteCount} vote${cat.voteCount !== 1 ? "s" : ""}`
              : `${cat.nominationCount} contender${cat.nominationCount !== 1 ? "s" : ""}`}
          </span>
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// Standard Card — compact, with differentiated first place
// ============================================================================

function StandardCard({
  cat,
  idx,
  portalSlug,
  router,
}: {
  cat: CategorySummary;
  idx: number;
  portalSlug: string;
  router: ReturnType<typeof useRouter>;
}) {
  const accent = getCategoryColor(cat.slug);
  const IconComponent = BEST_OF_ICONS[cat.slug] ?? DEFAULT_BEST_OF_ICON;
  const topThree = cat.topVenues?.slice(0, 3) ?? [];
  const leader = topThree[0];
  const runnersUp = topThree.slice(1);
  const maxScore = leader?.score ?? 1;

  return (
    <button
      type="button"
      onClick={() => router.push(`/${portalSlug}/best-of/${cat.slug}`)}
      className="text-left explore-track-enter focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded-xl"
      style={{ animationDelay: `${(idx + 2) * 60}ms`, outlineColor: accent }}
    >
      <div
        className="relative overflow-hidden rounded-xl p-3.5 h-[195px] flex flex-col transition-all duration-200 hover:scale-[1.01] group"
        style={{
          background: "var(--night)",
          border: "1px solid var(--twilight)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = accent;
          e.currentTarget.style.boxShadow = `0 0 16px ${accent}20`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--twilight)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {/* Left accent bar */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{
            background: accent,
            boxShadow: `2px 0 8px ${accent}40`,
          }}
        />

        {/* Corner gradient glow */}
        <div
          className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-[0.06] pointer-events-none"
          style={{ background: accent }}
        />

        {/* Icon + category name */}
        <div className="relative z-10 flex items-start gap-2.5 mb-1.5">
          <IconComponent
            size={20}
            weight="light"
            className="icon-neon flex-shrink-0"
            style={{ color: accent }}
          />
          <div className="flex-1 min-w-0">
            <h4
              className="font-semibold text-sm leading-tight tracking-tight truncate"
              style={{
                color: accent,
                textShadow: `0 0 8px ${accent}50`,
              }}
            >
              {cat.name.replace("Best ", "").replace("The ", "")}
            </h4>
          </div>
        </div>

        {/* Description */}
        {cat.description && (
          <p className="relative z-10 text-xs leading-relaxed italic line-clamp-2 text-[var(--cream)] opacity-60 mb-auto">
            {cat.description}
          </p>
        )}

        {/* First place — slightly elevated */}
        {leader && (
          <div className="relative z-10 mb-1">
            <div className="flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-mono font-black flex-shrink-0"
                style={{
                  background: `${RANK_COLORS[1]}25`,
                  color: RANK_COLORS[1],
                  boxShadow: `0 0 6px ${RANK_COLORS[1]}25`,
                }}
              >
                1
              </span>
              <span className="text-[12px] text-[var(--cream)] font-semibold truncate flex-1">
                {leader.name}
              </span>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <TrendUp size={10} weight="bold" style={{ color: accent }} className="opacity-60" />
                <span className="text-[10px] font-mono font-bold" style={{ color: accent }}>
                  {formatScore(leader.score)}
                </span>
              </div>
            </div>
            <div className="mt-1 pl-7">
              <ScoreBar score={leader.score} maxScore={maxScore} color={RANK_COLORS[1]} />
            </div>
          </div>
        )}

        {/* 2nd and 3rd — minimal */}
        {runnersUp.length > 0 && (
          <div className="relative z-10 space-y-0.5">
            {runnersUp.map((v, i) => {
              const rank = i + 2;
              const medalColor = rank === 2 ? RANK_COLORS[2] : RANK_COLORS[3];
              return (
                <div key={v.venueId} className="flex items-center gap-1.5">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-mono font-bold flex-shrink-0"
                    style={{
                      background: `${medalColor}20`,
                      color: medalColor,
                    }}
                  >
                    {rank}
                  </span>
                  <span className="text-[11px] text-[var(--cream)] font-medium truncate flex-1 opacity-75">
                    {v.name}
                  </span>
                  <span className="text-[9px] font-mono text-[var(--muted)] flex-shrink-0">
                    {formatScore(v.score)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </button>
  );
}
