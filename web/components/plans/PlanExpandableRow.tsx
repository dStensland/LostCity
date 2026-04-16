"use client";

import { useState } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";
import Link from "next/link";

interface PlanStop {
  time?: string;
  title: string;
  venue_name?: string;
}

interface PlanExpandableRowProps {
  plan: {
    id: string;
    title: string;
    plan_time?: string;
    stops: PlanStop[];
    participants: { initials: string; color: string }[];
  };
  portalSlug: string;
}

export function PlanExpandableRow({ plan, portalSlug }: PlanExpandableRowProps) {
  const [expanded, setExpanded] = useState(false);
  const isMultiStop = plan.stops.length > 1;
  const summary = isMultiStop
    ? `${plan.stops.length} stops · ${plan.plan_time ?? ""}`
    : plan.stops[0]?.venue_name ?? "";

  return (
    <div
      className="rounded-xl bg-[var(--night)] border border-[var(--twilight)] transition-colors duration-300"
      role="listitem"
      aria-label={`Plan: ${plan.title}, ${plan.stops.length} stops`}
    >
      <div
        className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer"
        onClick={() => isMultiStop && setExpanded(!expanded)}
      >
        <div className="w-[3px] rounded-sm self-stretch min-h-[32px] bg-[var(--coral)]/70 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <Link
            href={`/${portalSlug}/plans/${plan.id}`}
            className="text-sm font-medium text-[var(--cream)] truncate block hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {plan.title}
          </Link>
          <div className="text-xs text-[var(--muted)] mt-0.5">{summary}</div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--coral)]/10 text-[var(--coral)]/80">
            plan
          </span>
          {plan.participants.length > 0 && (
            <div className="flex -space-x-1.5">
              {plan.participants.slice(0, 3).map((p, i) => (
                <div
                  key={i}
                  className="w-5 h-5 rounded-full border-2 border-[var(--night)] flex items-center justify-center text-[9px] font-semibold text-[var(--cream)]/80"
                  style={{ backgroundColor: p.color }}
                >
                  {p.initials}
                </div>
              ))}
            </div>
          )}
          {isMultiStop && (
            expanded
              ? <CaretUp size={14} className="text-[var(--muted)]" />
              : <CaretDown size={14} className="text-[var(--muted)]" />
          )}
        </div>
      </div>
      {expanded && isMultiStop && (
        <div className="px-3 pb-2.5 ml-[11px] border-t border-[var(--twilight)]/50">
          {plan.stops.map((stop, i) => (
            <div key={i} className="flex items-center gap-2 py-1 text-xs text-[var(--muted)]">
              <span className="font-mono text-[10px] text-[var(--muted)]/60 min-w-[42px]">
                {stop.time ?? ""}
              </span>
              <span>{stop.title}{stop.venue_name ? ` — ${stop.venue_name}` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
