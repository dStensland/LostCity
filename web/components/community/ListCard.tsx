"use client";

import Link from "next/link";
import Image from "@/components/SmartImage";
import type { List } from "./ListsView";
import LinkifyText from "@/components/LinkifyText";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

interface ListCardProps {
  list: List;
  portalSlug: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  best_of: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  hidden_gems: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  ),
  date_night: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  with_friends: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  solo: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  budget: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  special_occasion: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" />
    </svg>
  ),
};

const CATEGORY_COLORS: Record<string, string> = {
  best_of: "#FBBF24",
  hidden_gems: "#A78BFA",
  date_night: "#F472B6",
  with_friends: "#6EE7B7",
  solo: "#5EEAD4",
  budget: "#4ADE80",
  special_occasion: "#F9A8D4",
};

export default function ListCard({ list, portalSlug }: ListCardProps) {
  const categoryColor = list.category ? CATEGORY_COLORS[list.category] || "var(--coral)" : "var(--coral)";
  const categoryIcon = list.category ? CATEGORY_ICONS[list.category] : null;
  const thumbnails = list.thumbnails || [];
  const accentClass = createCssVarClass("--accent-color", categoryColor, "accent");

  return (
    <>
      <ScopedStyles css={accentClass?.css} />
      <Link
        href={`/${portalSlug}/lists/${list.slug}`}
        className={`block p-4 rounded-xl border border-[var(--twilight)] card-atmospheric glow-accent group bg-[var(--card-bg)] ${accentClass?.className ?? ""}`}
      >
      <div className="flex items-start gap-4">
        {/* Thumbnails or Category icon */}
        {thumbnails.length > 0 ? (
          <div className="relative flex-shrink-0 w-14 h-14">
            {/* Stacked thumbnails - up to 3 overlapping */}
            {thumbnails.slice(0, 3).map((url, index) => (
              <div
                key={url}
                className={`absolute rounded-lg overflow-hidden border-2 shadow-md w-10 h-10 ${
                  index === 0 ? "border-accent" : "border-[var(--twilight)]"
                } thumb-stack-${index}`}
              >
                <Image
                  src={url}
                  alt=""
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-accent-20 text-accent"
          >
            {categoryIcon || (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-[var(--cream)] group-hover:text-[var(--glow-color)] transition-colors line-clamp-1">
            {list.title}
          </h3>

          {list.description && (
            <p className="text-sm text-[var(--muted)] mt-1 line-clamp-2">
              <LinkifyText text={list.description} />
            </p>
          )}

          {/* Meta info */}
          <div className="flex items-center gap-3 mt-2 text-xs font-mono text-[var(--muted)]">
            {/* Item count */}
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              {list.item_count} spot{list.item_count !== 1 ? "s" : ""}
            </span>

            {/* Vote count - only show when there are votes */}
            {list.vote_count > 0 ? (
              <span className="flex items-center gap-1 text-accent">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                {list.vote_count}
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[0.6rem] font-medium bg-[var(--twilight)] text-[var(--soft)]">
                New
              </span>
            )}

            {/* Open to contributions badge */}
            {list.allow_contributions && (
              <>
                <span className="flex items-center gap-1 text-[var(--soft)]">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Open
                </span>
                <span className="opacity-40">·</span>
              </>
            )}

            {/* Creator */}
            {list.creator && (
              <>
                <span className="opacity-40">·</span>
                <span className="flex items-center gap-1.5">
                  {list.creator.avatar_url ? (
                    <Image
                      src={list.creator.avatar_url}
                      alt={list.creator.display_name || list.creator.username}
                      width={14}
                      height={14}
                      className="rounded-full"
                    />
                  ) : (
                    <span
                      className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold bg-accent text-[var(--void)]"
                    >
                      {(list.creator.display_name || list.creator.username).charAt(0).toUpperCase()}
                    </span>
                  )}
                  {list.creator.display_name || `@${list.creator.username}`}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Arrow */}
        <svg
          className="w-5 h-5 text-[var(--muted)] group-hover:text-[var(--glow-color)] group-hover:translate-x-1 transition-all flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      </Link>
    </>
  );
}
