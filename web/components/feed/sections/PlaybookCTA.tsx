"use client";

/**
 * PlaybookCTA — "Plan Your Night" card shown in the feed.
 * More visible than the previous ghost link.
 */

import Link from "next/link";
import { MapTrifold, ArrowRight } from "@phosphor-icons/react";

interface PlaybookCTAProps {
  portalSlug: string;
}

export default function PlaybookCTA({ portalSlug }: PlaybookCTAProps) {
  return (
    <Link
      href={`/${portalSlug}/playbook`}
      className="group flex items-center gap-4 px-4 py-4 rounded-xl border border-[var(--twilight)]/30 bg-[var(--night)]/50 transition-all hover:border-[var(--gold)]/25 hover:bg-[var(--gold)]/[0.03]"
    >
      <div className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--gold)]/10 border border-[var(--gold)]/15">
        <MapTrifold
          weight="light"
          className="w-5 h-5 text-[var(--gold)]"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--cream)] group-hover:text-[var(--gold)] transition-colors">
          Plan Your Night
        </p>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          Build a timeline with walk times and share it
        </p>
      </div>
      <ArrowRight
        className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--gold)] group-hover:translate-x-0.5 transition-all shrink-0"
      />
    </Link>
  );
}
