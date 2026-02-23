"use client";

import Image from "@/components/SmartImage";

export type CurationTipData = {
  id: string;
  content: string;
  upvote_count: number;
  is_verified_visitor: boolean;
  created_at: string;
  author?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

interface CurationTipCardProps {
  tip: CurationTipData;
}

export default function CurationTipCard({ tip }: CurationTipCardProps) {
  const displayName = tip.author?.display_name || (tip.author?.username ? `@${tip.author.username}` : "Anonymous");

  return (
    <div className="p-3 rounded-lg bg-[var(--twilight)]/30 border border-[var(--twilight)]/50">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {tip.author?.avatar_url ? (
            <Image
              src={tip.author.avatar_url}
              alt={displayName}
              width={28}
              height={28}
              className="rounded-full"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-[var(--twilight)] flex items-center justify-center text-xs font-bold text-[var(--muted)]">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--cream)] leading-relaxed">
            {tip.content}
          </p>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-[var(--muted)]">
            <span>{displayName}</span>
            {tip.is_verified_visitor && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[var(--neon-green)]/10 text-[var(--neon-green)] text-[0.6rem] font-mono">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Visited
              </span>
            )}
            {tip.upvote_count > 0 && (
              <span className="flex items-center gap-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                {tip.upvote_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
