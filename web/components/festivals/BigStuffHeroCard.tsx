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

export default function BigStuffHeroCard({ item }: { item: BigStuffPageItem }) {
  const accent = TYPE_ACCENT[item.type];
  const Fallback = FALLBACK_ICON[item.type];
  const aria = `${item.title}, ${TYPE_LABEL[item.type].toLowerCase()}, ${formatDates(item.startDate, item.endDate)}${item.location ? `, ${item.location}` : ""}`;

  return (
    <Link
      href={item.href}
      data-type={item.type}
      aria-label={aria}
      className="group/hero block rounded-card overflow-hidden border border-[var(--twilight)] bg-[var(--night)] focus-ring"
      style={{ borderLeft: `2px solid ${accent}` }}
    >
      <div className="relative aspect-[21/9] sm:aspect-[21/9] max-sm:aspect-[16/9] bg-[var(--dusk)] overflow-hidden">
        {item.imageUrl ? (
          <SmartImage
            src={item.imageUrl}
            alt={item.title}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover transition-transform duration-700 ease-out group-hover/hero:scale-[1.04]"
          />
        ) : (
          <div
            data-hero-fallback
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${accent}22, var(--void))`,
            }}
          >
            <Fallback weight="duotone" className="w-24 h-24" style={{ color: accent, opacity: 0.6 }} />
          </div>
        )}

        {/* Pill overlays — top-left */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          {item.isLiveNow && (
            <span className="inline-flex px-2 py-0.5 rounded text-2xs font-mono font-bold tracking-[0.08em] uppercase bg-[var(--neon-red)]/15 border border-[var(--neon-red)]/40 text-[var(--neon-red)]">
              LIVE NOW
            </span>
          )}
          <span
            className="inline-flex px-2 py-0.5 rounded text-2xs font-mono font-bold tracking-[0.08em] uppercase"
            style={{
              backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`,
              border: `1px solid color-mix(in srgb, ${accent} 40%, transparent)`,
              color: accent,
            }}
          >
            {TYPE_LABEL[item.type]}
          </span>
        </div>
      </div>

      <div className="p-5">
        <h3 className="text-3xl font-bold text-[var(--cream)] tracking-[-0.01em] leading-tight group-hover/hero:underline decoration-[var(--gold)] underline-offset-[3px]">
          {item.title}
        </h3>
        <p className="text-sm text-[var(--muted)] mt-1">
          {formatDates(item.startDate, item.endDate)}
          {item.location && <> · {item.location}</>}
        </p>
        {item.description && (
          <p className="text-sm leading-relaxed text-[var(--soft)] mt-3">
            {item.description}
          </p>
        )}
      </div>
    </Link>
  );
}
