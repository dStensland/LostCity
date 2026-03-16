"use client";

import { memo } from "react";
import Link from "next/link";
import { ADV, ADV_FONT } from "@/lib/adventure-tokens";

export interface QuestMiniCardProps {
  questId: string;
  title: string;
  visitedCount: number;
  totalNodes: number;
  portalSlug: string;
}

export const QuestMiniCard = memo(function QuestMiniCard({
  questId,
  title,
  visitedCount,
  totalNodes,
  portalSlug,
}: QuestMiniCardProps) {
  const progressPct = totalNodes > 0 ? (visitedCount / totalNodes) * 100 : 0;
  const isComplete = visitedCount >= totalNodes && totalNodes > 0;

  return (
    <Link
      href={`/${portalSlug}?tab=quests&quest=${questId}`}
      className="flex-shrink-0 block p-3"
      style={{
        width: 192,
        border: `2px solid ${ADV.DARK}`,
        borderRadius: 0,
        backgroundColor: ADV.CARD,
        fontFamily: ADV_FONT,
      }}
    >
      {/* Title */}
      <p
        className="text-xs font-bold uppercase leading-tight mb-2"
        style={{
          letterSpacing: "0.08em",
          color: ADV.DARK,
          display: "-webkit-box",
          WebkitLineClamp: 1,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {title}
      </p>

      {/* Fraction */}
      <p
        className="text-sm font-bold mb-2"
        style={{ color: ADV.TERRACOTTA }}
      >
        {visitedCount}/{totalNodes}
      </p>

      {/* Progress bar */}
      <div
        className="h-1"
        style={{ backgroundColor: "#EBE8E3", borderRadius: 0 }}
      >
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${progressPct}%`,
            backgroundColor: isComplete ? ADV.OLIVE : ADV.TERRACOTTA,
            borderRadius: 0,
          }}
        />
      </div>
    </Link>
  );
});
