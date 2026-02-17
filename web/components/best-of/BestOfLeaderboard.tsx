"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAuthenticatedFetch } from "@/lib/hooks/useAuthenticatedFetch";
import type { BestOfCategory, BestOfRankedVenue } from "@/lib/best-of";
import { getCategoryColor, CASE_MIN_LENGTH, CASE_MAX_LENGTH } from "@/lib/best-of";
import BestOfVenueCard from "./BestOfVenueCard";
import NominateSpotSheet from "./NominateSpotSheet";
import { Info, CaretDown } from "@phosphor-icons/react/dist/ssr";
import { BEST_OF_ICONS, DEFAULT_BEST_OF_ICON } from "./best-of-icons";

interface BestOfLeaderboardProps {
  categorySlug: string;
  portalSlug: string;
}

export default function BestOfLeaderboard({ categorySlug, portalSlug }: BestOfLeaderboardProps) {
  const { user } = useAuth();
  const { authFetch } = useAuthenticatedFetch();
  const router = useRouter();

  const [category, setCategory] = useState<BestOfCategory | null>(null);
  const [venues, setVenues] = useState<BestOfRankedVenue[]>([]);
  const [userVoteVenueId, setUserVoteVenueId] = useState<number | null>(null);
  const [totalVotes, setTotalVotes] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNominateOpen, setIsNominateOpen] = useState(false);
  const [showScoring, setShowScoring] = useState(false);

  // Refs to avoid recreating handleVote on every state change
  const venuesRef = useRef(venues);
  venuesRef.current = venues;
  const userVoteRef = useRef(userVoteVenueId);
  userVoteRef.current = userVoteVenueId;
  const totalVotesRef = useRef(totalVotes);
  totalVotesRef.current = totalVotes;

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/best-of/${categorySlug}?portal=${portalSlug}`);
      if (!res.ok) {
        setError("Failed to load leaderboard");
        setIsLoading(false);
        return;
      }
      const data = await res.json();
      setCategory(data.category);
      setVenues(data.venues);
      setUserVoteVenueId(data.userVoteVenueId);
      setTotalVotes(data.totalVotes);
      setIsLoading(false);
    } catch {
      setError("Failed to load leaderboard");
      setIsLoading(false);
    }
  }, [categorySlug, portalSlug]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handleVote = useCallback(async (venueId: number) => {
    if (!user) {
      router.push(`/auth/login?redirect=/${portalSlug}/best-of/${categorySlug}`);
      return;
    }
    if (!category) return;

    // Read from refs to avoid dependency on state arrays
    const prevVenueId = userVoteRef.current;
    const prevVenues = [...venuesRef.current];
    const prevTotal = totalVotesRef.current;
    const isRetract = prevVenueId === venueId;

    // Optimistic update
    setVenues((prev) =>
      prev.map((v) => {
        if (v.venueId === venueId) {
          return { ...v, hasVoted: !isRetract, voteCount: isRetract ? v.voteCount - 1 : v.voteCount + 1 };
        }
        if (v.venueId === prevVenueId && !isRetract) {
          return { ...v, hasVoted: false, voteCount: v.voteCount - 1 };
        }
        return v;
      })
    );
    setUserVoteVenueId(isRetract ? null : venueId);
    setTotalVotes(isRetract ? prevTotal - 1 : prevVenueId ? prevTotal : prevTotal + 1);

    try {
      const { error: apiError } = await authFetch<{ success: boolean }>(`/api/best-of/${categorySlug}/vote`, {
        method: "POST",
        body: { categoryId: category.id, venueId },
      });
      if (apiError) throw new Error(apiError);
      // Trust optimistic state — no refetch needed
    } catch (err) {
      console.error("Vote failed:", err);
      setVenues(prevVenues);
      setUserVoteVenueId(prevVenueId);
      setTotalVotes(prevTotal);
    }
  }, [user, category, categorySlug, portalSlug, router, authFetch]);

  const handleCaseSubmit = useCallback(async (venueId: number, content: string) => {
    if (!user || !category) return;
    const { error: apiError } = await authFetch<{ success: boolean }>(`/api/best-of/${categorySlug}/cases`, {
      method: "POST",
      body: { categoryId: category.id, venueId, content },
    });
    if (apiError) throw new Error(apiError);
    await fetchLeaderboard();
  }, [user, category, categorySlug, authFetch, fetchLeaderboard]);

  const handleCaseUpvote = useCallback(async (caseId: string) => {
    if (!user) {
      router.push(`/auth/login?redirect=/${portalSlug}/best-of/${categorySlug}`);
      return;
    }
    const { error: apiError } = await authFetch<{ success: boolean }>(`/api/best-of/${categorySlug}/cases/${caseId}/upvote`, {
      method: "POST",
    });
    if (apiError) throw new Error(apiError);
    // Refetch to reflect updated scores from case upvotes
    fetchLeaderboard();
  }, [user, categorySlug, portalSlug, router, authFetch, fetchLeaderboard]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-20 skeleton-shimmer rounded-xl" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 skeleton-shimmer rounded-xl" />
        ))}
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--muted)] text-sm">{error ?? "Category not found"}</p>
      </div>
    );
  }

  const accentColor = getCategoryColor(categorySlug);
  const IconComponent = BEST_OF_ICONS[categorySlug] ?? DEFAULT_BEST_OF_ICON;
  const maxScore = venues.length > 0 ? venues[0].totalScore : 1;

  return (
    <div>
      {/* Header with accent glow bar */}
      <div className="mb-6">
        {/* Breadcrumb back link */}
        <a
          href={`/${portalSlug}?view=community&tab=bestof`}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--cream)] active:scale-95 transition-all mb-4 group rounded-sm px-1 -ml-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--action-primary)]"
        >
          <svg className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-mono uppercase tracking-wider">All Categories</span>
        </a>

        <div className="flex items-start gap-3 mb-4">
          {/* Glow bar */}
          <div
            className="w-[4px] h-20 rounded-full flex-shrink-0"
            style={{
              background: accentColor,
              boxShadow: `0 0 8px ${accentColor}50, 0 0 16px ${accentColor}25`,
            }}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2.5 mb-2">
              <IconComponent
                size={28}
                weight="light"
                className="icon-neon flex-shrink-0"
                style={{ color: accentColor }}
              />
              <h1 className="text-2xl font-bold text-[var(--cream)]">
                {category.name.replace("Best ", "")}
              </h1>
            </div>
            {category.description && (
              <p
                className="text-base leading-relaxed italic mt-1"
                style={{
                  color: `${accentColor}CC`,
                  textShadow: `0 0 6px ${accentColor}15`,
                }}
              >
                {category.description}
              </p>
            )}
          </div>
        </div>

        {/* Stat pills */}
        <div className="flex items-center gap-2 ml-[16px]">
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold backdrop-blur-sm"
            style={{
              background: `${accentColor}12`,
              border: `1px solid ${accentColor}25`,
              color: accentColor,
            }}
          >
            {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
          </span>
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono backdrop-blur-sm"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--muted)",
            }}
          >
            {venues.length} ranked
          </span>
        </div>
      </div>

      {/* How Scoring Works */}
      <div className="mb-4">
        <button
          onClick={() => setShowScoring((s) => !s)}
          className="flex items-center gap-1.5 text-xs font-mono text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
        >
          <Info size={14} weight="light" style={{ color: accentColor }} />
          <span className="uppercase tracking-wider">How scoring works</span>
          <CaretDown
            size={12}
            weight="bold"
            className="transition-transform"
            style={{
              color: accentColor,
              transform: showScoring ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </button>

        {showScoring && (
          <div
            className="mt-3 p-4 rounded-xl space-y-3 animate-fade-in"
            style={{
              background: "var(--night)",
              border: `1px solid ${accentColor}20`,
            }}
          >
            <p className="text-xs text-[var(--cream)] opacity-80 leading-relaxed">
              Rankings combine community signal with real activity data. Here&apos;s how spots earn points:
            </p>

            <div className="space-y-2">
              {/* Vote */}
              <div className="flex items-start gap-2.5">
                <span
                  className="inline-flex items-center justify-center w-8 h-5 rounded-full text-[10px] font-mono font-black flex-shrink-0"
                  style={{ background: `${accentColor}15`, color: accentColor }}
                >
                  +1
                </span>
                <div>
                  <span className="text-xs font-medium text-[var(--cream)]">Vote</span>
                  <p className="text-[11px] text-[var(--muted)] leading-snug mt-0.5">
                    Pick one spot per category. You can change it anytime.
                  </p>
                </div>
              </div>

              {/* Make Your Case */}
              <div className="flex items-start gap-2.5">
                <span
                  className="inline-flex items-center justify-center w-8 h-5 rounded-full text-[10px] font-mono font-black flex-shrink-0"
                  style={{ background: `${accentColor}25`, color: accentColor }}
                >
                  +3
                </span>
                <div>
                  <span className="text-xs font-medium text-[var(--cream)]">Make Your Case</span>
                  <p className="text-[11px] text-[var(--muted)] leading-snug mt-0.5">
                    Write why this spot deserves it ({CASE_MIN_LENGTH}-{CASE_MAX_LENGTH} characters).
                    The best arguments get upvoted and push venues higher.
                  </p>
                </div>
              </div>

              {/* Case Upvotes */}
              <div className="flex items-start gap-2.5">
                <span
                  className="inline-flex items-center justify-center w-8 h-5 rounded-full text-[10px] font-mono font-black flex-shrink-0"
                  style={{ background: `${accentColor}10`, color: accentColor }}
                >
                  +0.5
                </span>
                <div>
                  <span className="text-xs font-medium text-[var(--cream)]">Case Upvote</span>
                  <p className="text-[11px] text-[var(--muted)] leading-snug mt-0.5">
                    Each upvote on a case adds to the venue&apos;s score.
                  </p>
                </div>
              </div>

              {/* Activity Score */}
              <div className="flex items-start gap-2.5">
                <span
                  className="inline-flex items-center justify-center w-8 h-5 rounded-full text-[10px] font-mono font-black flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted)" }}
                >
                  ~
                </span>
                <div>
                  <span className="text-xs font-medium text-[var(--cream)]">Activity Score</span>
                  <p className="text-[11px] text-[var(--muted)] leading-snug mt-0.5">
                    Venues also earn baseline points from RSVPs, saves, follows, recommendations, and event listings.
                    Popular spots start with a head start, but votes and cases are what move the needle.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Nominate a Spot CTA */}
      {user && (
        <button
          onClick={() => setIsNominateOpen(true)}
          className="w-full mb-4 py-3 rounded-xl text-sm font-mono font-medium transition-all flex items-center justify-center gap-2"
          style={{
            border: `1.5px dashed ${accentColor}40`,
            color: accentColor,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${accentColor}08`;
            e.currentTarget.style.borderColor = `${accentColor}60`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = `${accentColor}40`;
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nominate a Spot
        </button>
      )}

      {/* Leaderboard */}
      {venues.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl"
          style={{
            background: "var(--night)",
            border: `1px solid var(--twilight)`,
          }}
        >
          <div className="flex justify-center mb-3">
            <IconComponent
              size={32}
              weight="light"
              className="icon-neon"
              style={{ color: accentColor }}
            />
          </div>
          <p className="text-sm text-[var(--muted)] mb-1">No venues ranked yet</p>
          {user ? (
            <p className="text-xs text-[var(--muted)] opacity-60">Be the first to nominate and vote!</p>
          ) : (
            <a
              href={`/auth/login?redirect=/${portalSlug}/best-of/${categorySlug}`}
              className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 rounded-lg text-xs font-mono font-medium transition-all"
              style={{
                background: accentColor,
                color: "var(--void)",
                boxShadow: `0 0 12px ${accentColor}30`,
              }}
            >
              Sign in to vote
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {venues.map((venue, i) => (
            <BestOfVenueCard
              key={venue.venueId}
              venue={venue}
              categorySlug={categorySlug}
              categoryId={category.id}
              categoryName={category.name}
              maxScore={maxScore}
              isAuthenticated={!!user}
              portalSlug={portalSlug}
              index={i}
              onVote={handleVote}
              onCaseSubmit={handleCaseSubmit}
              onCaseUpvote={handleCaseUpvote}
            />
          ))}
        </div>
      )}

      {/* Sign in prompt for anonymous users */}
      {!user && venues.length > 0 && (
        <div
          className="mt-6 p-4 rounded-xl"
          style={{
            background: `linear-gradient(135deg, ${accentColor}08, transparent)`,
            border: `1px solid ${accentColor}20`,
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--cream)]">Have a favorite?</p>
              <p className="text-xs text-[var(--muted)] mt-0.5">Sign in to vote and make your case</p>
            </div>
            <a
              href={`/auth/login?redirect=/${portalSlug}/best-of/${categorySlug}`}
              className="px-4 py-2 rounded-lg text-xs font-mono font-medium transition-all"
              style={{
                background: accentColor,
                color: "var(--void)",
                boxShadow: `0 0 8px ${accentColor}30`,
              }}
            >
              Sign In
            </a>
          </div>
        </div>
      )}

      {/* Nominate sheet */}
      {category && (
        <NominateSpotSheet
          isOpen={isNominateOpen}
          onClose={() => setIsNominateOpen(false)}
          categoryId={category.id}
          categorySlug={categorySlug}
          categoryName={category.name}
          accentColor={accentColor}
          portalSlug={portalSlug}
          onNominated={fetchLeaderboard}
        />
      )}
    </div>
  );
}
