"use client";

import { useState, useEffect, useRef } from "react";
import { UsersThree, CalendarCheck, HandHeart } from "@phosphor-icons/react";

interface ImpactSnapshot {
  week_window_days: number;
  matched_opportunities: number;
  groups_joined: number;
  new_meetings: number;
  generated_at: string;
}

interface StatDef {
  key: keyof Omit<ImpactSnapshot, "week_window_days" | "generated_at">;
  label: string;
  icon: React.ElementType;
}

const STATS: StatDef[] = [
  { key: "matched_opportunities", label: "Opportunities This Week", icon: HandHeart },
  { key: "new_meetings", label: "Meetings This Week", icon: CalendarCheck },
  { key: "groups_joined", label: "Groups Joined", icon: UsersThree },
];

export interface CivicImpactStripProps {
  portalSlug: string;
  variant?: "strip" | "card";
}

export function CivicImpactStrip({ portalSlug, variant = "strip" }: CivicImpactStripProps) {
  const [data, setData] = useState<ImpactSnapshot | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    fetch(`/api/portals/${portalSlug}/impact-snapshot`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ImpactSnapshot>;
      })
      .then((json) => {
        // Only show if there's something meaningful to display
        const hasData =
          json.matched_opportunities > 0 || json.new_meetings > 0 || json.groups_joined > 0;
        if (!hasData) {
          setStatus("error");
          return;
        }
        setData(json);
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      })
      .finally(() => clearTimeout(timeoutId));

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [portalSlug]);

  if (status === "error") return null;

  if (status === "loading") {
    return variant === "strip" ? <StripSkeleton /> : <CardSkeleton />;
  }

  if (!data) return null;

  return variant === "strip" ? (
    <StripLayout data={data} />
  ) : (
    <CardLayout data={data} />
  );
}

// ── Strip variant ─────────────────────────────────────────────────────────────

function StripLayout({ data }: { data: ImpactSnapshot }) {
  return (
    <div className="w-full flex items-stretch overflow-hidden rounded-xl border border-[var(--twilight)] bg-[var(--action-primary)]/8">
      {STATS.map((stat, i) => {
        const value = data[stat.key];
        const Icon = stat.icon;
        return (
          <div
            key={stat.key}
            className="flex-1 flex flex-col items-center justify-center py-3 px-2 gap-0.5"
            style={i > 0 ? { borderLeft: "1px solid color-mix(in srgb, var(--twilight) 60%, transparent)" } : undefined}
          >
            <Icon weight="duotone" className="w-4 h-4 text-[var(--action-primary)] mb-0.5" />
            <span className="text-2xl font-bold text-[var(--cream)] tabular-nums leading-none">
              {value}
            </span>
            <span className="text-2xs font-mono uppercase tracking-wider text-[var(--muted)] text-center leading-tight mt-0.5">
              {stat.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StripSkeleton() {
  return (
    <div className="w-full flex items-stretch overflow-hidden rounded-xl border border-[var(--twilight)] bg-[var(--action-primary)]/8 animate-pulse">
      {STATS.map((stat, i) => (
        <div
          key={stat.key}
          className="flex-1 flex flex-col items-center justify-center py-3 px-2 gap-1.5"
          style={i > 0 ? { borderLeft: "1px solid color-mix(in srgb, var(--twilight) 60%, transparent)" } : undefined}
        >
          <div className="w-8 h-6 rounded bg-[var(--twilight)]" />
          <div className="w-14 h-3 rounded bg-[var(--twilight)]/70" />
        </div>
      ))}
    </div>
  );
}

// ── Card variant ──────────────────────────────────────────────────────────────

function CardLayout({ data }: { data: ImpactSnapshot }) {
  return (
    <div className="rounded-xl border border-[var(--twilight)] bg-[var(--card-bg,var(--night))] overflow-hidden">
      <div className="px-4 pt-3.5 pb-1">
        <span className="font-mono text-xs font-bold tracking-[0.1em] uppercase text-[var(--action-primary)]">
          Impact This Week
        </span>
      </div>
      <div className="divide-y divide-[var(--twilight)]">
        {STATS.map((stat) => {
          const value = data[stat.key];
          const Icon = stat.icon;
          return (
            <div key={stat.key} className="flex items-center gap-3 px-4 py-2.5">
              <Icon
                weight="duotone"
                className="w-4 h-4 shrink-0 text-[var(--action-primary)]"
              />
              <span className="flex-1 text-sm text-[var(--soft)]">{stat.label}</span>
              <span className="text-xl font-bold tabular-nums text-[var(--action-primary)] leading-none">
                {value}
              </span>
            </div>
          );
        })}
      </div>
      <div className="px-4 py-2 border-t border-[var(--twilight)]">
        <span className="font-mono text-2xs text-[var(--muted)]">
          Next 7 days
        </span>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--twilight)] bg-[var(--card-bg,var(--night))] overflow-hidden animate-pulse">
      <div className="px-4 pt-3.5 pb-1">
        <div className="w-28 h-3 rounded bg-[var(--twilight)]" />
      </div>
      <div className="divide-y divide-[var(--twilight)]">
        {STATS.map((stat) => (
          <div key={stat.key} className="flex items-center gap-3 px-4 py-2.5">
            <div className="w-4 h-4 rounded bg-[var(--twilight)]" />
            <div className="flex-1 h-3 rounded bg-[var(--twilight)]" />
            <div className="w-6 h-5 rounded bg-[var(--twilight)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
