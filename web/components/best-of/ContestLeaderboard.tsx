"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "@/components/SmartImage";
import { useAuth } from "@/lib/auth-context";
import { useAuthenticatedFetch } from "@/lib/hooks/useAuthenticatedFetch";
import type { BestOfContest, ContestLeaderboardEntry } from "@/lib/best-of-contests";
import { formatTimeRemaining } from "@/lib/best-of-contests";
import { getRankColor } from "@/lib/best-of";
import { buildBestOfUrl } from "@/lib/find-url";
import MakeYourCaseSheet from "./MakeYourCaseSheet";
import NominateSpotSheet from "./NominateSpotSheet";

interface ContestLeaderboardProps {
  contest: BestOfContest;
  categorySlug: string;
  leaderboard: {
    venues: ContestLeaderboardEntry[];
    userVoteVenueId: number | null;
    totalVotes: number;
    categoryName: string;
    timeRemaining: string;
  };
  portalSlug: string;
}

const DEFAULT_ACCENT = "#E855A0";

export function ContestLeaderboard({
  contest,
  categorySlug,
  leaderboard: initialLeaderboard,
  portalSlug,
}: ContestLeaderboardProps) {
  const { user } = useAuth();
  const { authFetch } = useAuthenticatedFetch();
  const router = useRouter();

  const [venues, setVenues] = useState<ContestLeaderboardEntry[]>(initialLeaderboard.venues);
  const [userVoteVenueId, setUserVoteVenueId] = useState<number | null>(
    initialLeaderboard.userVoteVenueId
  );
  const [totalVotes, setTotalVotes] = useState(initialLeaderboard.totalVotes);
  const [timeRemaining, setTimeRemaining] = useState(initialLeaderboard.timeRemaining);
  const [caseSheetVenueId, setCaseSheetVenueId] = useState<number | null>(null);
  const [isNominateOpen, setIsNominateOpen] = useState(false);

  // Refs to avoid stale closures in optimistic update handler
  const venuesRef = useRef(venues);
  venuesRef.current = venues;
  const userVoteRef = useRef(userVoteVenueId);
  userVoteRef.current = userVoteVenueId;
  const totalVotesRef = useRef(totalVotes);
  totalVotesRef.current = totalVotes;

  const accentColor = contest.accentColor ?? DEFAULT_ACCENT;
  const isCompleted = contest.status === "completed";

  // Live countdown ticker
  useEffect(() => {
    if (isCompleted) return;
    const interval = setInterval(() => {
      setTimeRemaining(formatTimeRemaining(contest.endsAt));
    }, 60_000);
    return () => clearInterval(interval);
  }, [contest.endsAt, isCompleted]);

  const refetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/contests/${contest.slug}?portal=${portalSlug}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setVenues(data.venues ?? []);
      setUserVoteVenueId(data.userVoteVenueId ?? null);
      setTotalVotes(data.totalVotes ?? 0);
      setTimeRemaining(data.timeRemaining ?? "");
    } catch {
      // Silently fail — optimistic state already in place
    }
  }, [contest.slug, portalSlug]);

  const handleVote = useCallback(
    async (venueId: number) => {
      if (!user) {
        router.push(
          `/auth/login?redirect=/${portalSlug}/contests/${contest.slug}`
        );
        return;
      }
      if (isCompleted) return;

      const prevVenueId = userVoteRef.current;
      const prevVenues = [...venuesRef.current];
      const prevTotal = totalVotesRef.current;
      const isRetract = prevVenueId === venueId;

      // Optimistic update
      setVenues((prev) =>
        prev.map((v) => {
          if (v.venueId === venueId) {
            return {
              ...v,
              hasVoted: !isRetract,
              voteCount: isRetract ? v.voteCount - 1 : v.voteCount + 1,
            };
          }
          if (v.venueId === prevVenueId && !isRetract) {
            return { ...v, hasVoted: false, voteCount: v.voteCount - 1 };
          }
          return v;
        })
      );
      setUserVoteVenueId(isRetract ? null : venueId);
      setTotalVotes(
        isRetract ? prevTotal - 1 : prevVenueId ? prevTotal : prevTotal + 1
      );

      try {
        const { error: apiError } = await authFetch<{ success: boolean }>(
          `/api/best-of/${categorySlug}/vote`,
          {
            method: "POST",
            body: { categoryId: contest.categoryId, venueId },
          }
        );
        if (apiError) throw new Error(apiError);
      } catch {
        // Rollback
        setVenues(prevVenues);
        setUserVoteVenueId(prevVenueId);
        setTotalVotes(prevTotal);
      }
    },
    [user, contest, categorySlug, portalSlug, router, authFetch, isCompleted]
  );

  const handleCaseSubmit = useCallback(
    async (venueId: number, content: string) => {
      if (!user || isCompleted) return;
      const { error: apiError } = await authFetch<{ success: boolean }>(
        `/api/best-of/${categorySlug}/cases`,
        {
          method: "POST",
          body: { categoryId: contest.categoryId, venueId, content },
        }
      );
      if (apiError) throw new Error(apiError);
      await refetchLeaderboard();
    },
    [user, contest.categoryId, categorySlug, authFetch, refetchLeaderboard, isCompleted]
  );

  const caseSheetVenue = caseSheetVenueId != null
    ? venues.find((v) => v.venueId === caseSheetVenueId) ?? null
    : null;

  return (
    <div>
      {/* Hero section */}
      <div className="mb-6">
        {/* Back link */}
        <a
          href={buildBestOfUrl({ portalSlug })}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-all mb-4 group rounded-sm px-1 -ml-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--action-primary)]"
        >
          <svg
            className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span className="font-mono uppercase tracking-wider">All Categories</span>
        </a>

        {/* Label + title */}
        <div
          className="text-xs font-mono font-bold uppercase tracking-widest mb-2"
          style={{ color: accentColor }}
        >
          {isCompleted ? "CONTEST RESULTS" : "THIS WEEK'S BEST OF"}
        </div>
        <h1 className="text-2xl font-bold text-[var(--cream)] leading-tight mb-1">
          {contest.title}
        </h1>
        {contest.prompt && (
          <p
            className="text-sm italic mb-3"
            style={{ color: `${accentColor}CC` }}
          >
            {contest.prompt}
          </p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold"
            style={{
              background: `${accentColor}12`,
              border: `1px solid ${accentColor}25`,
              color: accentColor,
            }}
          >
            {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
          </span>
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--muted)",
            }}
          >
            {venues.length} {venues.length === 1 ? "venue" : "venues"}
          </span>
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono"
            style={{
              background: isCompleted
                ? "rgba(255,255,255,0.04)"
                : `${accentColor}10`,
              border: `1px solid ${isCompleted ? "rgba(255,255,255,0.08)" : `${accentColor}20`}`,
              color: isCompleted ? "var(--muted)" : accentColor,
            }}
          >
            {isCompleted ? "Ended" : timeRemaining}
          </span>
        </div>
      </div>

      {/* Winner announcement for completed contests */}
      {isCompleted && contest.winnerSnapshot && (
        <div
          className="mb-6 p-4 rounded-xl"
          style={{
            background: `linear-gradient(135deg, ${accentColor}15, ${accentColor}05)`,
            border: `1px solid ${accentColor}30`,
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🏆</span>
            <span
              className="text-xs font-mono font-bold uppercase tracking-widest"
              style={{ color: accentColor }}
            >
              Winner
            </span>
          </div>
          <p className="text-base font-semibold text-[var(--cream)]">
            {contest.winnerSnapshot.name}
          </p>
          {contest.winnerSnapshot.neighborhood && (
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {contest.winnerSnapshot.neighborhood}
            </p>
          )}
          {contest.winnerSnapshot.topCaseContent && (
            <blockquote
              className="mt-3 pl-3 text-sm italic text-[var(--soft)] leading-relaxed"
              style={{ borderLeft: `2px solid ${accentColor}50` }}
            >
              &ldquo;{contest.winnerSnapshot.topCaseContent}&rdquo;
              {contest.winnerSnapshot.topCaseAuthor && (
                <cite className="block mt-1 text-xs not-italic font-mono text-[var(--muted)]">
                  — @{contest.winnerSnapshot.topCaseAuthor}
                </cite>
              )}
            </blockquote>
          )}
        </div>
      )}

      {/* Leaderboard */}
      {venues.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl"
          style={{
            background: "var(--night)",
            border: "1px solid var(--twilight)",
          }}
        >
          <p className="text-sm text-[var(--muted)] mb-1">No venues ranked yet</p>
          {!user && !isCompleted && (
            <a
              href={`/auth/login?redirect=/${portalSlug}/contests/${contest.slug}`}
              className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg text-xs font-mono font-medium transition-all"
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
            <ContestVenueRow
              key={venue.venueId}
              venue={venue}
              index={i}
              accentColor={accentColor}
              isAuthenticated={!!user}
              isCompleted={isCompleted}
              portalSlug={portalSlug}
              onVote={handleVote}
              onCaseClick={() => setCaseSheetVenueId(venue.venueId)}
            />
          ))}
        </div>
      )}

      {/* Bottom CTAs */}
      {!isCompleted && venues.length > 0 && (
        <div className="mt-6 space-y-3">
          {user ? (
            <>
              <button
                onClick={() => setIsNominateOpen(true)}
                className="w-full py-3 rounded-xl text-sm font-mono font-medium transition-all"
                style={{
                  border: `1.5px solid ${accentColor}40`,
                  color: accentColor,
                }}
              >
                Don&apos;t see your spot? Nominate it
              </button>
            </>
          ) : (
            <div
              className="p-4 rounded-xl"
              style={{
                background: `linear-gradient(135deg, ${accentColor}08, transparent)`,
                border: `1px solid ${accentColor}20`,
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--cream)]">Have a favorite?</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    Sign in to vote and make your case
                  </p>
                </div>
                <a
                  href={`/auth/login?redirect=/${portalSlug}/contests/${contest.slug}`}
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
        </div>
      )}

      {/* Case sheet */}
      {caseSheetVenue && (
        <MakeYourCaseSheet
          isOpen={caseSheetVenueId != null}
          onClose={() => setCaseSheetVenueId(null)}
          onSubmit={(content) =>
            handleCaseSubmit(caseSheetVenue.venueId, content)
          }
          venueName={caseSheetVenue.name}
          categoryName={initialLeaderboard.categoryName ?? contest.title}
          accentColor={accentColor}
        />
      )}

      {/* Nominate sheet */}
      <NominateSpotSheet
        isOpen={isNominateOpen}
        onClose={() => setIsNominateOpen(false)}
        categoryId={contest.categoryId}
        categorySlug={categorySlug}
        categoryName={initialLeaderboard.categoryName ?? contest.title}
        accentColor={accentColor}
        portalSlug={portalSlug}
        onNominated={refetchLeaderboard}
      />
    </div>
  );
}

// ─── Contest Venue Row ────────────────────────────────────────────────────────

interface ContestVenueRowProps {
  venue: ContestLeaderboardEntry;
  index: number;
  accentColor: string;
  isAuthenticated: boolean;
  isCompleted: boolean;
  portalSlug: string;
  onVote: (venueId: number) => Promise<void>;
  onCaseClick: () => void;
}

function ContestVenueRow({
  venue,
  index,
  accentColor,
  isAuthenticated,
  isCompleted,
  portalSlug,
  onVote,
  onCaseClick,
}: ContestVenueRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const rankColor = getRankColor(venue.rank);
  const isTopThree = venue.rank <= 3;

  const handleVoteClick = async () => {
    if (isVoting || isCompleted) return;
    setIsVoting(true);
    try {
      await onVote(venue.venueId);
    } finally {
      setIsVoting(false);
    }
  };

  const handleVenueNavigate = () => {
    if (venue.slug) {
      window.location.href = `/${portalSlug}/spots/${venue.slug}`;
    }
  };

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-300"
      style={{
        background: "#141419",
        border: `1px solid ${isHovered ? `${accentColor}30` : "#2A2A35"}`,
        boxShadow: isHovered ? `0 0 12px ${accentColor}10` : "none",
        animationDelay: `${index * 60}ms`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Rank badge */}
        <div
          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold font-mono"
          style={{
            background: isTopThree ? `${rankColor}20` : "#2A2A35",
            color: isTopThree ? rankColor : "#888",
            border: `1px solid ${isTopThree ? `${rankColor}30` : "#3A3A45"}`,
            boxShadow: isTopThree ? `0 0 8px ${rankColor}25` : "none",
          }}
        >
          {venue.rank}
        </div>

        {/* Venue image */}
        {venue.imageUrl ? (
          <button
            onClick={handleVenueNavigate}
            className="flex-shrink-0 w-11 h-11 rounded-lg overflow-hidden bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ outlineColor: accentColor }}
          >
            <Image
              src={venue.imageUrl}
              alt={venue.name}
              width={44}
              height={44}
              className="w-full h-full object-cover"
            />
          </button>
        ) : (
          <div
            className="flex-shrink-0 w-11 h-11 rounded-lg"
            style={{ background: `${accentColor}15` }}
          />
        )}

        {/* Venue info */}
        <div className="flex-1 min-w-0">
          <button
            onClick={handleVenueNavigate}
            className="text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
            style={{ outlineColor: accentColor }}
          >
            <p
              className="text-sm font-semibold truncate transition-colors"
              style={{ color: isHovered ? accentColor : "var(--cream)" }}
            >
              {venue.name}
            </p>
          </button>
          <div className="flex items-center gap-1.5 mt-0.5">
            {venue.neighborhood && (
              <span className="text-xs text-[var(--muted)] truncate">
                {venue.neighborhood}
              </span>
            )}
            {venue.neighborhood && (
              <span className="text-[var(--muted)] opacity-40 text-xs">·</span>
            )}
            <span
              className="text-xs font-mono font-bold"
              style={{ color: `${accentColor}CC` }}
            >
              {venue.voteCount} {venue.voteCount === 1 ? "pt" : "pts"}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-1.5">
          {isAuthenticated && !isCompleted && (
            <button
              onClick={onCaseClick}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg transition-all min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                color: `${accentColor}70`,
                border: `1px solid ${accentColor}25`,
                outlineColor: accentColor,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${accentColor}10`;
                e.currentTarget.style.color = accentColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = `${accentColor}70`;
              }}
              aria-label="Make Your Case"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <span className="text-[10px] font-mono hidden sm:inline">Case</span>
            </button>
          )}

          {/* Vote button */}
          {!isCompleted ? (
            <button
              onClick={handleVoteClick}
              disabled={isVoting || !isAuthenticated}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs font-bold transition-all min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: venue.hasVoted ? accentColor : "transparent",
                color: venue.hasVoted ? "var(--void)" : accentColor,
                border: `1.5px solid ${accentColor}`,
                boxShadow: venue.hasVoted ? `0 0 10px ${accentColor}40` : "none",
                outlineColor: accentColor,
              }}
              aria-label={venue.hasVoted ? "Remove vote" : "Vote"}
            >
              {venue.hasVoted ? (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="hidden sm:inline">Voted</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                  <span className="hidden sm:inline">Vote</span>
                </>
              )}
            </button>
          ) : (
            // Completed: show vote count badge only
            <span
              className="px-2.5 py-1 rounded-full text-xs font-mono font-bold"
              style={{
                background: `${accentColor}12`,
                border: `1px solid ${accentColor}25`,
                color: accentColor,
              }}
            >
              {venue.voteCount}
            </span>
          )}
        </div>
      </div>

      {/* Top case for #1 venue */}
      {venue.rank === 1 && venue.topCase && (
        <div
          className="mx-3 mb-3 p-3 rounded-lg"
          style={{
            background: "rgba(0,0,0,0.4)",
            border: `1px solid ${accentColor}20`,
          }}
        >
          <p className="text-xs text-[var(--soft)] leading-relaxed italic">
            &ldquo;{venue.topCase.content}&rdquo;
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] font-mono text-[var(--muted)]">
              — @{venue.topCase.author.username}
            </span>
            <span className="text-[var(--muted)] opacity-30 text-xs">·</span>
            <span className="text-[10px] font-mono text-[var(--muted)]">
              {venue.topCase.upvoteCount} upvote{venue.topCase.upvoteCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export type { ContestLeaderboardProps };
