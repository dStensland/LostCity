"use client";

import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import { Crown, Users, MedalMilitary, HeartStraight, Star } from "@phosphor-icons/react";
import type { BigStuffPageItem, BigStuffType } from "@/lib/big-stuff/types";
import { TYPE_ACCENT, TYPE_LABEL } from "@/lib/big-stuff/types";

const FALLBACK_ICON: Record<BigStuffType, React.ComponentType<{ weight?: "duotone"; className?: string; style?: React.CSSProperties }>> = {
  festival: Crown,
  convention: Users,
  sports: MedalMilitary,
  community: HeartStraight,
  other: Star,
};

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDates(startDate: string, endDate: string | null): string {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const startLabel = `${MONTH_SHORT[sm - 1]} ${sd}`;
  if (!endDate || endDate === startDate) return startLabel;
  const [ey, em, ed] = endDate.split("-").map(Number);
  if (sy === ey && sm === em) return `${MONTH_SHORT[sm - 1]} ${sd} – ${ed}`;
  if (sy !== ey) return `${startLabel} – ${MONTH_SHORT[em - 1]} ${ed}, ${ey}`;
  return `${startLabel} – ${MONTH_SHORT[em - 1]} ${ed}`;
}

export default function BigStuffRow({ item }: { item: BigStuffPageItem }) {
  const accent = TYPE_ACCENT[item.type];
  const Fallback = FALLBACK_ICON[item.type];
  const aria = `${item.title}, ${TYPE_LABEL[item.type].toLowerCase()}, ${formatDates(item.startDate, item.endDate)}${item.location ? `, ${item.location}` : ""}`;

  return (
    <Link
      href={item.href}
      data-type={item.type}
      aria-label={aria}
      className="group/row grid grid-cols-[72px_1fr] sm:grid-cols-[72px_1fr] gap-3 items-start p-2.5 rounded-card border border-[var(--twilight)] bg-[var(--night)] hover:bg-[var(--dusk)] transition-colors focus-ring"
      style={{ borderLeft: `2px solid ${accent}` }}
    >
      <div className="relative w-[72px] h-[72px] max-sm:w-14 max-sm:h-14 rounded-md overflow-hidden bg-[var(--dusk)] flex-shrink-0">
        {item.imageUrl ? (
          <SmartImage src={item.imageUrl} alt="" fill sizes="72px" className="object-cover" />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${accent}22, var(--void))` }}
          >
            <Fallback weight="duotone" className="w-8 h-8" style={{ color: accent, opacity: 0.6 }} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-[var(--cream)] truncate group-hover/row:underline decoration-[var(--gold)] underline-offset-[3px]">
            {item.title}
          </p>
          <p className="text-sm text-[var(--muted)] truncate">
            {formatDates(item.startDate, item.endDate)}
            {item.location && <> · {item.location}</>}
          </p>
        </div>
        {item.isLiveNow ? (
          <span className="inline-flex flex-shrink-0 px-2 py-0.5 rounded text-2xs font-mono font-bold tracking-[0.08em] uppercase bg-[var(--neon-red)]/15 border border-[var(--neon-red)]/40 text-[var(--neon-red)]">
            LIVE NOW
          </span>
        ) : (
          <span
            className="inline-flex flex-shrink-0 px-2 py-0.5 rounded text-2xs font-mono font-bold tracking-[0.08em] uppercase"
            style={{
              backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`,
              border: `1px solid color-mix(in srgb, ${accent} 40%, transparent)`,
              color: accent,
            }}
          >
            {TYPE_LABEL[item.type]}
          </span>
        )}
      </div>
    </Link>
  );
}
