"use client";

import { memo } from "react";
import Link from "next/link";
import Image from "@/components/SmartImage";
import type { BestOfContest } from "@/lib/best-of-contests";
import { formatTimeRemaining } from "@/lib/best-of-contests";

interface ContestFeedCardLeader {
  name: string;
  neighborhood: string | null;
  imageUrl: string | null;
  voteCount: number;
}

interface ContestFeedCardProps {
  contest: BestOfContest;
  leader: ContestFeedCardLeader | null;
  totalVotes: number;
  venueCount: number;
  portalSlug: string;
}

const DEFAULT_ACCENT = "#E855A0";

function ContestFeedCardInner({
  contest,
  leader,
  totalVotes,
  venueCount,
  portalSlug,
}: ContestFeedCardProps) {
  const accentColor = contest.accentColor ?? DEFAULT_ACCENT;
  const contestUrl = `/${portalSlug}/contests/${contest.slug}`;
  const timeRemaining = formatTimeRemaining(contest.endsAt);
  const isEnded = timeRemaining === "Ended";

  return (
    <div
      className="rounded-2xl overflow-hidden relative"
      style={{
        background: "#141419",
        border: "1px solid #2A2A35",
        boxShadow: `0 0 24px ${accentColor}15, 0 0 8px ${accentColor}08`,
      }}
    >
      {/* Top accent gradient bar */}
      <div
        className="h-1 w-full"
        style={{
          background: `linear-gradient(to right, ${accentColor}, transparent)`,
        }}
      />

      <div className="p-4">
        {/* Label */}
        <div
          className="text-xs font-mono font-bold uppercase tracking-widest mb-2"
          style={{ color: accentColor }}
        >
          {isEnded ? "CONTEST RESULTS" : "THIS WEEK'S BEST OF"}
        </div>

        {/* Title */}
        <h2
          className="font-semibold leading-tight mb-1"
          style={{
            fontSize: "32px",
            fontFamily: "var(--font-serif)",
            color: "var(--cream)",
          }}
        >
          {contest.title}
        </h2>

        {/* Prompt */}
        {contest.prompt && (
          <p
            className="text-sm italic mb-4 leading-snug"
            style={{ color: "#888" }}
          >
            {contest.prompt}
          </p>
        )}

        {/* Current leader */}
        {leader ? (
          <div
            className="flex items-center gap-3 p-3 rounded-xl mb-4"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid #2A2A35",
            }}
          >
            {/* Gold rank badge */}
            <div
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold font-mono"
              style={{
                background: "rgba(255,215,0,0.15)",
                color: "#FFD700",
                border: "1px solid rgba(255,215,0,0.25)",
                boxShadow: "0 0 8px rgba(255,215,0,0.2)",
              }}
            >
              1
            </div>

            {/* Venue image */}
            {leader.imageUrl ? (
              <div className="flex-shrink-0 w-11 h-11 rounded-lg overflow-hidden">
                <Image
                  src={leader.imageUrl}
                  alt={leader.name}
                  width={44}
                  height={44}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div
                className="flex-shrink-0 w-11 h-11 rounded-lg"
                style={{ background: `${accentColor}15` }}
              />
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div
                className="text-[9px] font-mono font-bold uppercase tracking-wider mb-0.5"
                style={{ color: accentColor }}
              >
                CURRENT LEADER
              </div>
              <p className="text-sm font-semibold text-[var(--cream)] truncate">
                {leader.name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {leader.neighborhood && (
                  <span className="text-xs text-[var(--muted)] truncate">
                    {leader.neighborhood}
                  </span>
                )}
                {leader.neighborhood && (
                  <span className="text-[var(--muted)] opacity-30 text-xs">·</span>
                )}
                <span
                  className="text-xs font-mono font-bold"
                  style={{ color: `${accentColor}CC` }}
                >
                  {leader.voteCount} {leader.voteCount === 1 ? "vote" : "votes"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="flex items-center justify-center h-16 rounded-xl mb-4"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px dashed #2A2A35",
            }}
          >
            <p className="text-xs font-mono text-[var(--muted)]">
              No votes yet — be the first!
            </p>
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-2 mb-4">
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono"
            style={{
              background: `${accentColor}10`,
              border: `1px solid ${accentColor}20`,
              color: accentColor,
            }}
          >
            {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
          </span>
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid #2A2A35",
              color: "#888",
            }}
          >
            {venueCount} {venueCount === 1 ? "venue" : "venues"}
          </span>
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono"
            style={{
              background: isEnded ? "rgba(255,255,255,0.04)" : `${accentColor}10`,
              border: `1px solid ${isEnded ? "#2A2A35" : `${accentColor}20`}`,
              color: isEnded ? "#888" : accentColor,
            }}
          >
            {timeRemaining}
          </span>
        </div>

        {/* CTA */}
        <Link
          href={contestUrl}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-mono text-sm font-bold transition-all active:scale-95"
          style={{
            background: accentColor,
            color: "var(--void)",
            boxShadow: `0 0 16px ${accentColor}35`,
          }}
        >
          {isEnded ? "See Results" : "Cast Your Vote"}
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}

export const ContestFeedCard = memo(ContestFeedCardInner);

export type { ContestFeedCardProps };
