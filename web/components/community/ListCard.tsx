"use client";

import Link from "next/link";
import Image from "@/components/SmartImage";
import type { Curation } from "@/lib/curation-utils";
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  CATEGORY_GRADIENTS,
  DEFAULT_GRADIENT,
} from "@/lib/curation-constants";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import Dot from "@/components/ui/Dot";

interface ListCardProps {
  list: Curation;
  portalSlug: string;
  featured?: boolean;
}

export default function ListCard({ list, portalSlug, featured }: ListCardProps) {
  const categoryColor =
    list.accent_color ||
    (list.category ? CATEGORY_COLORS[list.category] || "var(--coral)" : "var(--coral)");
  const categoryIcon = list.category ? CATEGORY_ICONS[list.category] : null;
  const categoryLabel = list.category ? CATEGORY_LABELS[list.category] : null;
  const thumbnails = list.thumbnails || [];
  const accentClass = createCssVarClass("--accent-color", categoryColor, "accent");
  const isOpen = list.allow_contributions || list.submission_mode === "open";
  const gradient =
    (list.category ? CATEGORY_GRADIENTS[list.category] : null) || DEFAULT_GRADIENT;

  // ── Featured card (Staff Picks) ─────────────────────────────────────
  if (featured) {
    return (
      <>
        <ScopedStyles css={accentClass?.css} />
        <Link
          href={`/${portalSlug}/curations/${list.slug}`}
          className={`block rounded-xl border border-[var(--twilight)] overflow-hidden group bg-[var(--card-bg)] hover:border-accent/40 transition-all hover:shadow-lg hover:shadow-accent/5 ${accentClass?.className ?? ""}`}
        >
          {/* Cover area — real image or gradient fallback */}
          <div className="relative h-36 sm:h-44 overflow-hidden">
            {list.cover_image_url ? (
              <Image
                src={list.cover_image_url}
                alt=""
                width={500}
                height={200}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div
                className="w-full h-full group-hover:scale-105 transition-transform duration-500"
                style={{ background: gradient }}
              />
            )}
            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--card-bg)] via-[var(--card-bg)]/40 to-transparent" />

            {/* Category badge — positioned over the cover */}
            {categoryLabel && (
              <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono uppercase tracking-wider bg-[var(--void)]/70 backdrop-blur-sm text-accent border border-accent/20">
                {categoryIcon}
                {categoryLabel}
              </div>
            )}

            {/* Editorial badge */}
            {list.owner_type === "editorial" && (
              <div className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono uppercase tracking-wider bg-accent/90 text-[var(--void)] font-bold">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                Staff Pick
              </div>
            )}

            {/* Thumbnail strip at bottom of cover */}
            {thumbnails.length > 0 && (
              <div className="absolute bottom-3 right-3 flex -space-x-2">
                {thumbnails.slice(0, 4).map((url, i) => (
                  <div
                    key={url}
                    className="w-8 h-8 rounded-full overflow-hidden border-2 border-[var(--card-bg)] shadow-md"
                    style={{ zIndex: 4 - i }}
                  >
                    <Image src={url} alt="" width={32} height={32} className="w-full h-full object-cover" />
                  </div>
                ))}
                {list.item_count > 4 && (
                  <div className="w-8 h-8 rounded-full border-2 border-[var(--card-bg)] bg-[var(--twilight)] flex items-center justify-center text-2xs font-mono text-[var(--muted)]">
                    +{list.item_count - 4}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Content area */}
          <div className="p-4 sm:p-5">
            {/* Title */}
            <h3 className="text-lg font-serif font-bold text-[var(--cream)] group-hover:text-accent transition-colors mb-1.5">
              {list.title}
            </h3>

            {/* Description */}
            {list.description && (
              <p className="text-sm text-[var(--soft)] leading-relaxed line-clamp-2 mb-3">
                {list.description}
              </p>
            )}

            {/* Vibe tags */}
            {list.vibe_tags && list.vibe_tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {list.vibe_tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full text-xs font-mono bg-accent-10 text-accent"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Bottom row: stats + CTA */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--twilight)]/50">
              <div className="flex items-center gap-3 text-xs font-mono text-[var(--muted)]">
                <span>{list.item_count} spot{list.item_count !== 1 ? "s" : ""}</span>
                {list.vote_count > 0 && (
                  <span className="flex items-center gap-1 text-accent">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    {list.vote_count}
                  </span>
                )}
                {(list.follower_count ?? 0) > 0 && (
                  <span>{list.follower_count} follower{list.follower_count !== 1 ? "s" : ""}</span>
                )}
              </div>

              {isOpen ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-accent group-hover:translate-x-0.5 transition-transform">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add yours
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              ) : (
                <svg className="w-4 h-4 text-[var(--muted)] group-hover:text-accent group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          </div>
        </Link>
      </>
    );
  }

  // ── Default card ──────────────────────────────────────────────────────
  return (
    <>
      <ScopedStyles css={accentClass?.css} />
      <Link
        href={`/${portalSlug}/curations/${list.slug}`}
        className={`block rounded-xl border border-[var(--twilight)] overflow-hidden group bg-[var(--card-bg)] hover:border-accent/30 transition-all ${accentClass?.className ?? ""}`}
      >
        {/* Cover image hero (if available) */}
        {list.cover_image_url && (
          <div className="relative h-28 overflow-hidden">
            <Image
              src={list.cover_image_url}
              alt=""
              width={400}
              height={112}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--card-bg)] via-transparent to-transparent" />
          </div>
        )}

        <div className="p-3 sm:p-4">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Thumbnails, gradient square, or category icon */}
            {!list.cover_image_url && thumbnails.length > 0 ? (
              <div className="relative flex-shrink-0 w-14 h-14">
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
            ) : !list.cover_image_url ? (
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: gradient }}
              >
                <span className="text-white/80 drop-shadow-sm">
                  {categoryIcon || (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  )}
                </span>
              </div>
            ) : null}

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-[var(--cream)] group-hover:text-accent transition-colors line-clamp-1">
                {list.title}
              </h3>

              {list.description && (
                <p className="text-sm text-[var(--muted)] mt-1 line-clamp-2">
                  {list.description}
                </p>
              )}

              {/* Vibe tags */}
              {list.vibe_tags && list.vibe_tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {list.vibe_tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 rounded text-xs font-mono bg-accent-20 text-accent"
                    >
                      {tag}
                    </span>
                  ))}
                  {list.vibe_tags.length > 3 && (
                    <span className="px-1.5 py-0.5 rounded text-xs font-mono text-[var(--muted)]">
                      +{list.vibe_tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Meta info */}
              <div className="flex items-center gap-3 mt-2 text-xs font-mono text-[var(--muted)]">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  {list.item_count} spot{list.item_count !== 1 ? "s" : ""}
                </span>

                {list.vote_count > 0 ? (
                  <span className="flex items-center gap-1 text-accent">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    {list.vote_count}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-[var(--twilight)] text-[var(--soft)]">
                    New
                  </span>
                )}

                {(list.follower_count ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    {list.follower_count}
                  </span>
                )}

                {isOpen && (
                  <span className="flex items-center gap-1 text-accent">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Open
                  </span>
                )}

                {list.creator && (
                  <>
                    <Dot />
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
              className="w-5 h-5 text-[var(--muted)] group-hover:text-accent group-hover:translate-x-1 transition-all flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </Link>
    </>
  );
}
