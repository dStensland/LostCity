"use client";

import type { EditorialGroup } from '@/lib/film/types';

const LABEL: Record<EditorialGroup, string> = {
  opens: 'OPENS THIS WEEK',
  now: 'NOW PLAYING',
  closes: 'CLOSES THIS WEEK',
};

const TONE: Record<EditorialGroup, string> = {
  opens: 'text-[var(--gold)]',
  now: 'text-[var(--vibe)]',
  closes: 'text-[var(--coral)]',
};

interface Props {
  group: EditorialGroup;
  count: number;
}

export default function EditorialGroupHeader({ group, count }: Props) {
  const toneClass = TONE[group];
  return (
    <div className="flex items-baseline gap-3 mt-2">
      <span
        className={`font-mono text-xs font-bold uppercase tracking-[0.16em] ${toneClass}`}
      >
        {LABEL[group]}
      </span>
      <span className="flex-1 h-px bg-[var(--twilight)]" />
      <span className="font-mono text-xs text-[var(--muted)]">
        {count} film{count === 1 ? '' : 's'}
      </span>
    </div>
  );
}
