"use client";

import { memo } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { ADV } from "@/lib/adventure-tokens";

// ---- Types ---------------------------------------------------------------

export interface QuestProgressCardProps {
  questId: string;
  title: string;
  subtitle: string;
  totalNodes: number;
  visitedCount: number;
  portalSlug: string;
}

// ---- Component -----------------------------------------------------------

export const QuestProgressCard = memo(function QuestProgressCard({
  questId,
  title,
  subtitle,
  totalNodes,
  visitedCount,
  portalSlug,
}: QuestProgressCardProps) {
  const progressPct = totalNodes > 0 ? (visitedCount / totalNodes) * 100 : 0;
  const isComplete = visitedCount >= totalNodes && totalNodes > 0;

  return (
    <div
      className="p-4"
      style={{
        border: `2px solid ${ADV.DARK}`,
        borderRadius: 0,
        backgroundColor: ADV.CARD,
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3
            className="font-bold leading-tight mb-0.5"
            style={{
              fontSize: "1.0625rem",
              color: ADV.DARK,
            }}
          >
            {title}
          </h3>
          <p
            className="text-sm leading-snug"
            style={{ color: ADV.STONE }}
          >
            {subtitle}
          </p>
        </div>

        {isComplete && (
          <span
            className="flex-shrink-0 px-2.5 py-1 text-xs font-bold uppercase text-white"
            style={{
              letterSpacing: "0.1em",
              backgroundColor: ADV.TERRACOTTA,
              borderRadius: 0,
            }}
          >
            Done
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div
        className="relative h-2 mb-2"
        style={{
          backgroundColor: "#EBE8E3",
          borderRadius: 0,
        }}
      >
        <div
          className="absolute inset-y-0 left-0 transition-all duration-500"
          style={{
            width: `${progressPct}%`,
            backgroundColor: isComplete ? ADV.OLIVE : ADV.OLIVE,
            borderRadius: 0,
          }}
        />
      </div>

      {/* Progress label */}
      <div
        className="flex items-center justify-between text-xs font-bold uppercase"
        style={{
          letterSpacing: "0.1em",
          color: ADV.STONE,
        }}
      >
        <span>
          {visitedCount} of {totalNodes} discovered
        </span>
        <Link
          href={`/${portalSlug}?tab=quests&quest=${questId}`}
          className="flex items-center gap-1 hover:opacity-70 transition-opacity"
          style={{ color: ADV.TERRACOTTA }}
        >
          View
          <ArrowRight size={12} weight="bold" />
        </Link>
      </div>
    </div>
  );
});
