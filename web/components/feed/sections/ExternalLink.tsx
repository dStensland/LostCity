"use client";

import Image from "@/components/SmartImage";
import { isSafeUrl } from "./types";
import type { FeedSectionData } from "./types";

export function ExternalLink({ section }: { section: FeedSectionData }) {
  const content = section.block_content as {
    url?: string;
    image_url?: string;
    cta_text?: string;
  } | null;

  if (!content?.url || !isSafeUrl(content.url)) {
    return null;
  }

  return (
    <section className="mb-4 sm:mb-6">
      <a
        href={content.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 p-4 rounded-xl border border-[var(--twilight)] hover:border-[var(--coral)]/30 transition-all group bg-[var(--card-bg)]"
        aria-label={`${section.title} (opens in new tab)`}
      >
        {content.image_url && (
          <div className="relative w-16 h-16 rounded-lg bg-[var(--twilight)] flex-shrink-0 overflow-hidden">
            <Image
              src={content.image_url}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors">
              {section.title}
            </h3>
            <span className="px-1.5 py-0.5 rounded text-2xs font-mono bg-[var(--twilight)] text-[var(--muted)]">
              External
            </span>
          </div>
          {section.description && (
            <p className="font-mono text-xs text-[var(--muted)] mt-0.5 line-clamp-2">
              {section.description}
            </p>
          )}
        </div>
        <svg
          className="w-5 h-5 text-[var(--muted)] group-hover:text-[var(--cream)] group-hover:translate-x-1 transition-all flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </a>
    </section>
  );
}
