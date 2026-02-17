"use client";

import { useState, useEffect } from "react";
import type { BestOfCasePreview } from "@/lib/best-of";

interface CaseCardProps {
  caseData: BestOfCasePreview;
  accentColor: string;
  onUpvote: (caseId: string) => Promise<void>;
  isAuthenticated: boolean;
}

export default function CaseCard({ caseData, accentColor, onUpvote, isAuthenticated }: CaseCardProps) {
  const [upvoteCount, setUpvoteCount] = useState(caseData.upvoteCount);
  const [hasUpvoted, setHasUpvoted] = useState(caseData.hasUpvoted);

  // Sync local state from parent when props change (e.g., after refetch)
  useEffect(() => {
    setUpvoteCount(caseData.upvoteCount);
    setHasUpvoted(caseData.hasUpvoted);
  }, [caseData.upvoteCount, caseData.hasUpvoted]);
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleUpvote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading || !isAuthenticated) return;

    const prevCount = upvoteCount;
    const prevUpvoted = hasUpvoted;
    setHasUpvoted(!hasUpvoted);
    setUpvoteCount(hasUpvoted ? upvoteCount - 1 : upvoteCount + 1);

    setIsLoading(true);
    try {
      await onUpvote(caseData.id);
    } catch {
      setHasUpvoted(prevUpvoted);
      setUpvoteCount(prevCount);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg backdrop-blur-sm"
      style={{
        background: `${accentColor}08`,
        border: `1px solid ${accentColor}15`,
      }}
    >
      {/* Quote mark */}
      <div
        className="text-2xl leading-none font-serif flex-shrink-0 mt-0.5"
        style={{ color: `${accentColor}60` }}
      >
        &ldquo;
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--cream)] leading-relaxed opacity-85">{caseData.content}</p>
        <div className="flex items-center gap-2 mt-2">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: `${accentColor}15` }}
          >
            <span
              className="text-[10px] font-mono font-bold"
              style={{ color: accentColor }}
            >
              {caseData.author.username.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-[10px] text-[var(--muted)] font-mono uppercase tracking-[0.14em]">
            {caseData.author.username}
          </span>
        </div>
      </div>

      {/* Upvote — min 44px touch target */}
      <button
        onClick={handleUpvote}
        disabled={isLoading || !isAuthenticated}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-lg transition-all flex-shrink-0 min-w-[44px] min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          ...(hasUpvoted
            ? {
                color: accentColor,
                background: `${accentColor}15`,
              }
            : isHovered
              ? {
                  color: accentColor,
                  background: `${accentColor}10`,
                }
              : {
                  color: "var(--muted)",
                }),
          outlineColor: accentColor,
        }}
        aria-label={hasUpvoted ? "Remove upvote" : "Upvote this case"}
      >
        <svg className="w-4 h-4" fill={hasUpvoted ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
        <span className="text-[10px] font-mono">{upvoteCount}</span>
      </button>
    </div>
  );
}
