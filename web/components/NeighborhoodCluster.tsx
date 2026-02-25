"use client";

import { useState } from "react";
import { MapPin, CaretDown } from "@phosphor-icons/react/dist/ssr";
import AroundMeCard from "@/components/AroundMeCard";
import type { NeighborhoodCluster as ClusterType } from "@/lib/neighborhood-grouping";

interface Props {
  cluster: ClusterType;
  defaultExpanded?: boolean;
  portalSlug: string;
  highlight?: boolean;
  showDistance?: boolean;
}

export default function NeighborhoodCluster({
  cluster,
  defaultExpanded = false,
  portalSlug,
  highlight = false,
  showDistance = true,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded || highlight);
  const totalItems = cluster.eventCount + cluster.spotCount;

  // Events first, then spots
  const allItems = [...cluster.events, ...cluster.spots];

  return (
    <div className={`mb-1 ${highlight ? "rounded-xl border border-[var(--coral)]/25 bg-[var(--coral)]/[0.03] -mx-2 px-2" : ""}`}>
      {/* Header — always visible, toggles expand */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between py-3 px-1 group"
      >
        <div className="flex items-center gap-2.5">
          {highlight && (
            <MapPin weight="fill" className="w-3.5 h-3.5 text-[var(--coral)] flex-shrink-0" />
          )}
          <h3 className={`font-medium text-sm transition-colors ${
            highlight
              ? "text-[var(--coral)] group-hover:text-[var(--cream)]"
              : "text-[var(--cream)] group-hover:text-[var(--coral)]"
          }`}>
            {cluster.neighborhood}
          </h3>
          <div className="flex items-center gap-1.5">
            {cluster.eventCount > 0 && (
              <span className="font-mono text-[0.65rem] font-semibold px-1.5 py-0.5 rounded bg-[var(--neon-red)]/12 text-[var(--neon-red)]/80">
                {cluster.eventCount} {cluster.eventCount === 1 ? "event" : "events"}
              </span>
            )}
            {cluster.spotCount > 0 && (
              <span className="font-mono text-[0.65rem] font-semibold px-1.5 py-0.5 rounded bg-[var(--neon-green)]/12 text-[var(--neon-green)]/80">
                {cluster.spotCount} open
              </span>
            )}
          </div>
        </div>
        <CaretDown
          weight="bold"
          className={`w-3.5 h-3.5 text-[var(--muted)] group-hover:text-[var(--soft)] transition-all duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Items — shown only when expanded */}
      {expanded && (
        <div className="space-y-2 pb-3">
          {allItems.map((item, index) => (
            <AroundMeCard
              key={`${item.type}-${item.id}`}
              item={item}
              index={index}
              portalSlug={portalSlug}
              showDistance={showDistance}
              insideCluster
            />
          ))}
          {totalItems > 6 && (
            <button
              onClick={() => setExpanded(false)}
              className="w-full py-2 font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
            >
              Collapse
            </button>
          )}
        </div>
      )}
    </div>
  );
}
