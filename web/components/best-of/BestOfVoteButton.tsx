"use client";

import { useState } from "react";

interface BestOfVoteButtonProps {
  hasVoted: boolean;
  onVote: () => Promise<void>;
  accentColor: string;
  disabled?: boolean;
  compact?: boolean;
}

export default function BestOfVoteButton({ hasVoted, onVote, accentColor, disabled, compact }: BestOfVoteButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading || disabled) return;
    setIsLoading(true);
    try {
      await onVote();
    } finally {
      setIsLoading(false);
    }
  };

  // Show retract hint when hovering voted state
  const showRetract = hasVoted && isHovered && !isLoading;

  if (compact) {
    return (
      <button
        onClick={handleClick}
        disabled={isLoading || disabled}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-mono font-medium transition-all duration-200 min-h-[32px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          ...(hasVoted
            ? showRetract
              ? {
                  background: "rgba(239,68,68,0.15)",
                  color: "#ef4444",
                  border: "1px solid rgba(239,68,68,0.3)",
                }
              : {
                  background: accentColor,
                  color: "var(--void)",
                  boxShadow: `0 0 12px ${accentColor}40, 0 0 4px ${accentColor}60`,
                }
            : isHovered
              ? {
                  background: `${accentColor}20`,
                  color: accentColor,
                }
              : {
                  background: "rgba(255,255,255,0.06)",
                  color: "var(--cream)",
                }),
          outlineColor: accentColor,
        }}
      >
        {isLoading ? (
          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : showRetract ? (
          <>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Undo
          </>
        ) : hasVoted ? (
          <>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Your Pick
          </>
        ) : (
          <>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            Vote
          </>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading || disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-mono font-medium transition-all duration-200 w-full min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${isLoading ? "opacity-50" : ""}`}
      style={{
        ...(hasVoted
          ? showRetract
            ? {
                background: "rgba(239,68,68,0.12)",
                color: "#ef4444",
                border: "1px solid rgba(239,68,68,0.25)",
              }
            : {
                background: accentColor,
                color: "var(--void)",
                boxShadow: `0 0 16px ${accentColor}30, 0 0 6px ${accentColor}50`,
              }
          : isHovered
            ? {
                background: `${accentColor}18`,
                borderColor: `${accentColor}30`,
                color: accentColor,
                border: `1px solid ${accentColor}30`,
              }
            : {
                background: "rgba(255,255,255,0.06)",
                color: "var(--cream)",
                border: "1px solid rgba(255,255,255,0.08)",
              }),
        outlineColor: accentColor,
      }}
    >
      {isLoading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : showRetract ? (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Retract Vote
        </>
      ) : hasVoted ? (
        <>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Your Pick
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          Vote for This Spot
        </>
      )}
    </button>
  );
}
