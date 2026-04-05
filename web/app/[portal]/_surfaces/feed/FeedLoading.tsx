import HorseSpinner from "@/components/ui/HorseSpinner";
import { isFilmPortalVertical, toFeedSkeletonVertical } from "@/lib/portal-taxonomy";
import type { PortalVertical } from "@/lib/portal-taxonomy";

export function FeedLoading({ vertical }: { vertical: PortalVertical }) {
  const skeletonVertical = toFeedSkeletonVertical(vertical);

  if (vertical === "marketplace") {
    return (
      <div
        data-skeleton-route="feed-view"
        data-skeleton-vertical="marketplace"
        className="space-y-6 py-6"
      >
        <div className="h-[340px] rounded-b-3xl skeleton-shimmer" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-8 w-20 rounded-full skeleton-shimmer"
              style={{ animationDelay: `${i * 40}ms` }}
            />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl skeleton-shimmer"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl skeleton-shimmer"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (vertical === "hotel") {
    return (
      <div
        data-skeleton-route="feed-view"
        data-skeleton-vertical={skeletonVertical}
        className="space-y-6 py-6"
      >
        <section className="rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6">
          <div className="h-3 w-28 rounded skeleton-shimmer" />
          <div className="mt-3 h-10 w-[72%] rounded skeleton-shimmer" />
          <div className="mt-3 h-4 w-full rounded skeleton-shimmer" />
          <div className="mt-2 h-4 w-[82%] rounded skeleton-shimmer" />
          <div className="mt-5 flex flex-wrap gap-2">
            <div className="h-8 w-28 rounded-full skeleton-shimmer" />
            <div className="h-8 w-24 rounded-full skeleton-shimmer" />
            <div className="h-8 w-32 rounded-full skeleton-shimmer" />
          </div>
        </section>
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-56 rounded-2xl skeleton-shimmer"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (isFilmPortalVertical(vertical)) {
    return (
      <div
        data-skeleton-route="feed-view"
        data-skeleton-vertical={skeletonVertical}
        className="space-y-6 py-6"
      >
        <div className="h-56 rounded-3xl skeleton-shimmer" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="h-24 rounded-2xl skeleton-shimmer" />
          <div className="h-24 rounded-2xl skeleton-shimmer" />
          <div className="h-24 rounded-2xl skeleton-shimmer" />
        </div>
        <div className="h-64 rounded-2xl skeleton-shimmer" />
      </div>
    );
  }

  if (vertical === "community") {
    return (
      <div
        data-skeleton-route="feed-view"
        data-skeleton-vertical="community"
        className="mt-2 space-y-4"
      >
        <div className="space-y-4 rounded-xl border border-[var(--twilight)] bg-[var(--night)] p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="h-7 w-44 rounded skeleton-shimmer" />
              <div
                className="h-4 w-36 rounded skeleton-shimmer"
                style={{ animationDelay: "40ms" }}
              />
            </div>
            <div className="h-9 w-24 rounded-lg skeleton-shimmer" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-12 rounded-lg skeleton-shimmer"
                style={{ animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2 px-1">
          {[28, 24, 32, 20].map((w, i) => (
            <div
              key={i}
              className="h-8 rounded-full skeleton-shimmer"
              style={{ width: `${w * 4}px`, animationDelay: `${i * 40}ms` }}
            />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl border border-[var(--twilight)] skeleton-shimmer"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      data-skeleton-route="feed-view"
      data-skeleton-vertical={skeletonVertical}
      className="mt-4"
      style={{ minHeight: 400 }}
    >
      <div className="flex items-center justify-center py-16">
        <HorseSpinner />
      </div>
    </div>
  );
}

export function DogSavedLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-4">
      <div
        className="flex gap-1 rounded-xl p-1"
        style={{ background: "rgba(253, 232, 138, 0.25)" }}
      >
        <div className="h-10 flex-1 rounded-lg skeleton-shimmer" />
        <div
          className="h-10 flex-1 rounded-lg skeleton-shimmer"
          style={{ animationDelay: "60ms" }}
        />
      </div>
      <div className="mt-4 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-20 rounded-2xl skeleton-shimmer"
            style={{ animationDelay: `${i * 70}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function DogMapLoading() {
  return (
    <div
      className="flex flex-col"
      style={{ height: "calc(100dvh - 56px - 64px)" }}
    >
      <div className="flex gap-2 px-4 py-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-8 w-20 flex-shrink-0 rounded-full skeleton-shimmer"
            style={{ animationDelay: `${i * 40}ms` }}
          />
        ))}
      </div>
      <div className="flex-1 skeleton-shimmer" />
    </div>
  );
}
