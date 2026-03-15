"use client";

import Link from "next/link";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { isSafeUrl } from "./types";
import type { FeedSectionData } from "./types";

export function Announcement({ section }: { section: FeedSectionData }) {
  const content = section.block_content as {
    text?: string;
    cta_text?: string;
    cta_url?: string;
    background_color?: string;
    text_color?: string;
    icon?: string;
  } | null;

  if (!content?.text) {
    return null;
  }

  const style = section.style as {
    background_color?: string;
    text_color?: string;
    border_color?: string;
    accent_color?: string;
  } | null;

  const accentColor = style?.accent_color || "var(--coral)";
  const accent = createCssVarClass("--accent-color", accentColor, "accent");
  const bg = createCssVarClass(
    "--announcement-bg",
    style?.background_color || content.background_color || "var(--dusk)",
    "announcement-bg",
  );
  const border = createCssVarClass(
    "--announcement-border",
    style?.border_color || "var(--twilight)",
    "announcement-border",
  );
  const text = createCssVarClass(
    "--announcement-text",
    style?.text_color || content.text_color || "var(--cream)",
    "announcement-text",
  );

  return (
    <section className="mb-4 sm:mb-6">
      <ScopedStyles css={accent?.css} />
      <ScopedStyles css={bg?.css} />
      <ScopedStyles css={border?.css} />
      <ScopedStyles css={text?.css} />
      <div
        data-accent
        className={`p-5 rounded-xl border-l-4 border announcement-card ${
          accent?.className ?? ""
        } ${bg?.className ?? ""} ${border?.className ?? ""} ${text?.className ?? ""}`}
      >
        <div className="flex gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-accent-20">
            <svg
              className="w-5 h-5 text-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
              />
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1">
            {section.title && (
              <h3 className="text-lg font-semibold tracking-tight mb-1 announcement-title">
                {section.title}
              </h3>
            )}
            <p className="font-mono text-sm leading-relaxed announcement-body">
              {content.text}
            </p>
            {content.cta_url &&
              content.cta_text &&
              isSafeUrl(content.cta_url) && (
                <Link
                  href={content.cta_url}
                  data-accent
                  className={`inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg font-mono text-sm font-medium transition-colors bg-accent text-[var(--void)] ${accent?.className ?? ""}`}
                >
                  {content.cta_text}
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              )}
          </div>
        </div>
      </div>
    </section>
  );
}
