"use client";

import { memo } from "react";
import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react";
import type { GroupWithMeta } from "@/lib/types/groups";

interface GroupCardProps {
  group: GroupWithMeta;
}

export const GroupCard = memo(function GroupCard({ group }: GroupCardProps) {
  const hasActiveHangs = group.active_hang_count > 0;

  return (
    <Link
      href={`/groups/${group.id}`}
      className="flex items-center gap-3 p-3.5 rounded-xl bg-[var(--night)] border border-[var(--twilight)] hover:border-[var(--vibe)]/40 transition-colors group active:scale-[0.99]"
    >
      {/* Emoji avatar */}
      <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-[var(--vibe)]/10 border border-[var(--vibe)]/20 flex items-center justify-center text-xl leading-none select-none">
        {group.emoji ?? "👥"}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-base font-semibold text-[var(--cream)] truncate group-hover:text-[var(--vibe)] transition-colors">
            {group.name}
          </p>
          {hasActiveHangs && (
            <span className="flex items-center gap-1 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)] animate-pulse" />
              <span className="text-2xs font-mono text-[var(--neon-green)]">
                {group.active_hang_count} out now
              </span>
            </span>
          )}
        </div>

        <p className="text-xs text-[var(--muted)] mt-0.5">
          {group.member_count} {group.member_count === 1 ? "member" : "members"}
        </p>

        {group.latest_activity && (
          <p className="text-sm text-[var(--soft)] mt-0.5 truncate">
            {group.latest_activity}
          </p>
        )}
      </div>

      {/* Chevron */}
      <CaretRight
        weight="bold"
        className="w-4 h-4 text-[var(--muted)] flex-shrink-0 group-hover:text-[var(--vibe)] transition-colors"
      />
    </Link>
  );
});

export type { GroupCardProps };
