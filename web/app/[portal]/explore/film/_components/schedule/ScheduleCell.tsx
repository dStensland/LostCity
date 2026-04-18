"use client";

import Link from 'next/link';
import { buildSeriesUrl } from '@/lib/entity-urls';
import { cellLeft, cellWidth } from '@/lib/film/schedule-geometry';
import type { FilmScreening, FormatToken } from '@/lib/film/types';

const FORMAT_LABEL: Partial<Record<FormatToken, string>> = {
  true_imax: 'TRUE IMAX',
  imax: 'IMAX',
  dolby_cinema: 'DOLBY CINEMA',
  '4dx': '4DX',
  screenx: 'SCREENX',
  rpx: 'RPX',
  '70mm': '70MM',
  '35mm': '35MM',
};

interface Props {
  screening: FilmScreening;
  startTime: string;
  matchesFilter: boolean;
  portalSlug: string;
  closesToday?: boolean;
}

export default function ScheduleCell({
  screening,
  startTime,
  matchesFilter,
  portalSlug,
  closesToday = false,
}: Props) {
  const left = cellLeft(startTime);
  const width = cellWidth(screening.runtime_minutes);
  const href = buildSeriesUrl(screening.slug, portalSlug, 'film');

  const borderClass = screening.is_premiere
    ? 'border-[var(--gold)]'
    : closesToday
      ? 'border-[var(--coral)]'
      : 'border-[var(--vibe)]/40';

  const matchClass = matchesFilter
    ? 'hover:ring-1 hover:ring-[var(--cream)]/30'
    : 'opacity-20 grayscale pointer-events-none';

  const fmt = screening.times[0]?.format_labels[0];
  const metaBits = [
    screening.runtime_minutes ? `${screening.runtime_minutes}m` : null,
    screening.rating,
    fmt ? (FORMAT_LABEL[fmt] ?? fmt.toUpperCase()) : null,
  ].filter(Boolean);

  return (
    <Link
      href={href}
      prefetch={false}
      style={{ left: `${left}px`, width: `${width}px`, top: '4px', height: '64px' }}
      className={`absolute flex flex-col justify-center px-2 py-1 rounded-md bg-[var(--dusk)] border ${borderClass} hover:bg-[var(--dusk)]/80 transition-colors overflow-hidden ${matchClass}`}
    >
      <span className="font-semibold text-sm text-[var(--cream)] truncate leading-tight">
        {screening.title}
      </span>
      {metaBits.length > 0 && (
        <span className="font-mono text-2xs text-[var(--muted)] truncate mt-0.5">
          {metaBits.join(' · ')}
        </span>
      )}
    </Link>
  );
}
