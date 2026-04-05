"use client";

import Link from "next/link";
import type { ExploreEditorialGuide } from "@/lib/explore-platform/editorial-guides";

interface EditorialGuidePageProps {
  portalSlug: string;
  guide: ExploreEditorialGuide;
}

export function EditorialGuidePage({
  portalSlug,
  guide,
}: EditorialGuidePageProps) {
  return (
    <div className="min-h-screen bg-[var(--void)] text-[var(--cream)]">
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <Link
          href={`/${portalSlug}/explore`}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--twilight)]/50 px-3 py-1.5 text-xs font-mono uppercase tracking-[0.14em] text-[var(--soft)] transition-colors hover:border-[var(--twilight)] hover:text-[var(--cream)]"
        >
          Back to Explore
        </Link>

        <section className="mt-6 overflow-hidden rounded-[28px] border border-[var(--twilight)]/40 bg-[var(--night)]/55">
          <div
            className="h-1.5 w-full"
            style={{ backgroundColor: guide.accentToken }}
          />
          <div className="px-5 py-8 sm:px-8 sm:py-10">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--soft)]">
              Editorial Guide
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--cream)] sm:text-4xl">
              {guide.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--soft)]">
              {guide.description}
            </p>
            <p className="mt-6 max-w-3xl text-sm leading-7 text-[var(--cream)]/88">
              {guide.intro}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              {guide.note}
            </p>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {guide.sections.map((section) => (
            <article
              key={section.title}
              className="rounded-3xl border border-[var(--twilight)]/35 bg-[var(--night)]/45 p-5"
            >
              <h2 className="text-lg font-medium text-[var(--cream)]">
                {section.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--soft)]">
                {section.description}
              </p>
              <Link
                href={section.href}
                className="mt-5 inline-flex items-center rounded-full border border-[var(--twilight)]/55 px-3 py-1.5 text-xs font-mono uppercase tracking-[0.14em] text-[var(--soft)] transition-colors hover:border-[var(--twilight)] hover:text-[var(--cream)]"
              >
                {section.cta}
              </Link>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
