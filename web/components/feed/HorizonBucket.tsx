"use client";

import { useState } from "react";
import CountBadge from "@/components/ui/CountBadge";
import type { HorizonBucket as HorizonBucketType } from "@/lib/city-pulse/types";
import { HorizonHeadlinerCard } from "@/components/feed/HorizonHeadlinerCard";
import { HorizonSupportingRow } from "@/components/feed/HorizonSupportingRow";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VISIBLE_CAP = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HorizonBucketProps {
  bucket: HorizonBucketType;
  portalSlug: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HorizonBucketComponent({ bucket, portalSlug }: HorizonBucketProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleRows = expanded ? bucket.supporting : bucket.supporting.slice(0, VISIBLE_CAP);
  const hiddenCount = bucket.supporting.length - VISIBLE_CAP;

  return (
    <div className="border-l-2 border-[var(--gold)]/30 pl-4">
      {/* Bucket header */}
      <div className="mb-3 flex items-center gap-2">
        <span className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--gold)]">
          {bucket.label}
        </span>
        <span className="text-[var(--muted)]">·</span>
        <span className="font-mono text-xs text-[var(--muted)]">
          {bucket.relativeLabel}
        </span>
        <CountBadge placement="inline" count={bucket.totalCount} />
      </div>

      {/* Small bucket: skip headliner, just list supporting rows */}
      {bucket.isSmallBucket ? (
        <div className="space-y-0.5">
          {visibleRows.map((item) => (
            <HorizonSupportingRow
              key={item.event.id}
              item={item}
              portalSlug={portalSlug}
            />
          ))}
        </div>
      ) : (
        <>
          {/* Normal bucket: headliner + supporting rows */}
          {bucket.headliner && (
            <div className="mb-2">
              <HorizonHeadlinerCard
                item={bucket.headliner}
                portalSlug={portalSlug}
              />
            </div>
          )}

          {visibleRows.length > 0 && (
            <div className="space-y-0.5">
              {visibleRows.map((item) => (
                <HorizonSupportingRow
                  key={item.event.id}
                  item={item}
                  portalSlug={portalSlug}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Overflow disclosure */}
      {hiddenCount > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1.5 w-full rounded-lg px-3 py-2 text-center font-mono text-xs text-[var(--gold)] hover:bg-[var(--twilight)]/30"
        >
          {hiddenCount} more in {bucket.label}
        </button>
      )}
    </div>
  );
}

export type { HorizonBucketProps };
