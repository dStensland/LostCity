"use client";

import FilterChip from '@/components/filters/FilterChip';
import type { FormatToken } from '@/lib/film/types';

export type FilmFilters = {
  formats: FormatToken[];
  driveIn: boolean;
  premieresOnly: boolean;
  oneNightOnly: boolean;
  festival: boolean;
};

export const DEFAULT_FILTERS: FilmFilters = {
  formats: [],
  driveIn: false,
  premieresOnly: false,
  oneNightOnly: false,
  festival: false,
};

const FORMAT_LABELS: Array<{ id: FormatToken; label: string }> = [
  { id: '35mm', label: '35mm' },
  { id: '70mm', label: '70mm' },
  { id: 'true_imax', label: 'True IMAX' },
  { id: 'imax', label: 'IMAX' },
  { id: 'dolby_cinema', label: 'Dolby Cinema' },
  { id: '4dx', label: '4DX' },
];

interface FilmFilterChipsProps {
  value: FilmFilters;
  onChange: (next: FilmFilters) => void;
}

export default function FilmFilterChips({ value, onChange }: FilmFilterChipsProps) {
  const toggleFormat = (fmt: FormatToken) => {
    const next = value.formats.includes(fmt)
      ? value.formats.filter((f) => f !== fmt)
      : [...value.formats, fmt];
    onChange({ ...value, formats: next });
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
      <span className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)] shrink-0">
        Filter:
      </span>
      {FORMAT_LABELS.map((f) => (
        <FilterChip
          key={f.id}
          label={f.label}
          variant="date"
          size="sm"
          active={value.formats.includes(f.id)}
          onClick={() => toggleFormat(f.id)}
        />
      ))}
      <FilterChip
        label="drive-in"
        variant="date"
        size="sm"
        active={value.driveIn}
        onClick={() => onChange({ ...value, driveIn: !value.driveIn })}
      />
      <FilterChip
        label="premieres only"
        variant="vibe"
        size="sm"
        active={value.premieresOnly}
        onClick={() => onChange({ ...value, premieresOnly: !value.premieresOnly })}
      />
      <FilterChip
        label="one-night-only"
        variant="vibe"
        size="sm"
        active={value.oneNightOnly}
        onClick={() => onChange({ ...value, oneNightOnly: !value.oneNightOnly })}
      />
      <FilterChip
        label="festival"
        variant="vibe"
        size="sm"
        active={value.festival}
        onClick={() => onChange({ ...value, festival: !value.festival })}
      />
    </div>
  );
}
