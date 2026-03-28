"use client";

import { useState, memo } from "react";
import { useRouter } from "next/navigation";
import Image from "@/components/SmartImage";
import type { BestOfRankedVenue } from "@/lib/best-of";
import { getRankColor, getCategoryColor } from "@/lib/best-of";
import BestOfVoteButton from "./BestOfVoteButton";
import CaseCard from "./CaseCard";
import MakeYourCaseSheet from "./MakeYourCaseSheet";

interface BestOfVenueCardProps {
  venue: BestOfRankedVenue;
  categorySlug: string;
  categoryId: string;
  categoryName: string;
  maxScore: number;
  isAuthenticated: boolean;
  portalSlug: string;
  index: number;
  onVote: (venueId: number) => Promise<void>;
  onCaseSubmit: (venueId: number, content: string) => Promise<void>;
  onCaseUpvote: (caseId: string) => Promise<void>;
}

function BestOfVenueCardInner({
  venue,
  categorySlug,
  categoryName,
  isAuthenticated,
  portalSlug,
  index,
  onVote,
  onCaseSubmit,
  onCaseUpvote,
}: BestOfVenueCardProps) {
  const router = useRouter();
  const [isCaseSheetOpen, setIsCaseSheetOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const accentColor = getCategoryColor(categorySlug);
  const rankColor = getRankColor(venue.rank);
  const isTopThree = venue.rank <= 3;

  const handleVenueClick = () => {
    if (venue.slug) {
      router.push(`/${portalSlug}/venues/${venue.slug}`);
    }
  };

  return (
    <>
      <div
        className="group rounded-xl overflow-hidden transition-all duration-300 explore-track-enter"
        style={{
          background: "var(--night)",
          border: `1px solid ${isHovered ? `${accentColor}40` : "var(--twilight)"}`,
          boxShadow: isHovered ? `0 0 12px ${accentColor}15, 0 0 4px ${accentColor}25` : "none",
          animationDelay: `${index * 80}ms`,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Left accent border + content */}
        <div className="flex">
          {/* Left glow bar */}
          <div
            className="w-[3px] flex-shrink-0"
            style={{
              background: accentColor,
              boxShadow: isTopThree
                ? `2px 0 8px ${accentColor}40, 4px 0 16px ${accentColor}20`
                : `1px 0 4px ${accentColor}20`,
            }}
          />

          <div className="flex-1 p-3">
            <div className="flex gap-3">
              {/* Rank badge */}
              <div className="flex-shrink-0 flex flex-col items-center gap-1">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold font-mono"
                  style={{
                    background: isTopThree ? `${rankColor}20` : `${rankColor}10`,
                    color: rankColor,
                    border: `1px solid ${rankColor}30`,
                    boxShadow: isTopThree ? `0 0 8px ${rankColor}25` : "none",
                  }}
                >
                  {venue.rank}
                </div>
              </div>

              {/* Venue info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3">
                  {/* Image */}
                  {venue.imageUrl && (
                    <button
                      onClick={handleVenueClick}
                      className="flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{ outlineColor: accentColor }}
                    >
                      <Image
                        src={venue.imageUrl}
                        alt={venue.name}
                        width={64}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  )}

                  <div className="flex-1 min-w-0">
                    <button
                      onClick={handleVenueClick}
                      className="text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
                      style={{ outlineColor: accentColor }}
                    >
                      <h3
                        className="text-[15px] font-semibold text-[var(--cream)] transition-colors truncate"
                        style={{ color: isHovered ? accentColor : "var(--cream)" }}
                      >
                        {venue.name}
                      </h3>
                    </button>
                    {venue.neighborhood && (
                      <p className="text-xs text-[var(--muted)] mt-0.5 truncate">{venue.neighborhood}</p>
                    )}

                    {/* Vote count pill */}
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-mono font-bold backdrop-blur-sm flex-shrink-0"
                        style={{
                          background: `${accentColor}12`,
                          border: `1px solid ${accentColor}25`,
                          color: accentColor,
                        }}
                      >
                        {venue.voteCount} {venue.voteCount === 1 ? "vote" : "votes"}
                      </span>
                    </div>
                  </div>

                  {/* Vote button + Make Your Case */}
                  <div className="flex-shrink-0 flex items-center gap-1.5">
                    {isAuthenticated && (
                      <button
                        onClick={() => setIsCaseSheetOpen(true)}
                        className="flex items-center gap-1 px-2.5 py-2 rounded-lg transition-all min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                        style={{
                          color: `${accentColor}80`,
                          border: `1px solid ${accentColor}30`,
                          outlineColor: accentColor,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = `${accentColor}10`;
                          e.currentTarget.style.borderColor = `${accentColor}50`;
                          e.currentTarget.style.color = accentColor;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.borderColor = `${accentColor}30`;
                          e.currentTarget.style.color = `${accentColor}80`;
                        }}
                        aria-label="Make Your Case"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span className="text-[10px] font-mono hidden sm:inline">Case</span>
                      </button>
                    )}
                    <BestOfVoteButton
                      hasVoted={venue.hasVoted}
                      onVote={() => onVote(venue.venueId)}
                      accentColor={accentColor}
                      disabled={!isAuthenticated}
                      compact
                    />
                  </div>
                </div>

                {/* Top case */}
                {venue.topCase && (
                  <div className="mt-2">
                    <CaseCard
                      caseData={venue.topCase}
                      accentColor={accentColor}
                      onUpvote={onCaseUpvote}
                      isAuthenticated={isAuthenticated}
                    />
                    {venue.caseCount > 1 && (
                      <p className="text-[10px] text-[var(--muted)] font-mono mt-1.5 text-right">
                        + {venue.caseCount - 1} more {venue.caseCount === 2 ? "case" : "cases"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <MakeYourCaseSheet
        isOpen={isCaseSheetOpen}
        onClose={() => setIsCaseSheetOpen(false)}
        onSubmit={(content) => onCaseSubmit(venue.venueId, content)}
        venueName={venue.name}
        categoryName={categoryName}
        accentColor={accentColor}
      />
    </>
  );
}

const BestOfVenueCard = memo(BestOfVenueCardInner, (prev, next) => {
  const pv = prev.venue;
  const nv = next.venue;
  return (
    pv.venueId === nv.venueId &&
    pv.hasVoted === nv.hasVoted &&
    pv.voteCount === nv.voteCount &&
    pv.rank === nv.rank &&
    pv.totalScore === nv.totalScore &&
    pv.caseCount === nv.caseCount &&
    pv.topCase?.id === nv.topCase?.id &&
    pv.topCase?.upvoteCount === nv.topCase?.upvoteCount &&
    pv.topCase?.hasUpvoted === nv.topCase?.hasUpvoted &&
    prev.isAuthenticated === next.isAuthenticated
  );
});

BestOfVenueCard.displayName = "BestOfVenueCard";

export default BestOfVenueCard;
