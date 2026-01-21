import PageHeader from "@/components/PageHeader";

export default function EventLoading() {
  return (
    <div className="min-h-screen">
      <PageHeader />

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Image skeleton */}
        <div className="aspect-video bg-[var(--twilight)]/30 rounded-lg mb-6 skeleton-shimmer" />

        {/* Main card skeleton */}
        <div className="border border-[var(--twilight)] rounded-lg p-6 sm:p-8" style={{ backgroundColor: "var(--card-bg)" }}>
          {/* Category badge */}
          <div className="flex gap-2 mb-4">
            <div className="h-5 w-16 rounded skeleton-shimmer" />
          </div>

          {/* Title */}
          <div className="h-8 w-3/4 rounded skeleton-shimmer mb-2" />
          <div className="h-8 w-1/2 rounded skeleton-shimmer" style={{ animationDelay: "0.05s" }} />

          {/* Venue */}
          <div className="h-5 w-48 rounded skeleton-shimmer mt-3" style={{ animationDelay: "0.1s" }} />

          {/* Date/Time/Price grid */}
          <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-lg p-3 sm:p-4 border border-[var(--twilight)]"
                style={{ backgroundColor: "var(--void)" }}
              >
                <div className="h-3 w-8 mx-auto rounded skeleton-shimmer mb-2" style={{ animationDelay: `${i * 0.05}s` }} />
                <div className="h-6 w-12 mx-auto rounded skeleton-shimmer" style={{ animationDelay: `${i * 0.05 + 0.05}s` }} />
                <div className="h-3 w-10 mx-auto rounded skeleton-shimmer mt-1" style={{ animationDelay: `${i * 0.05 + 0.1}s` }} />
              </div>
            ))}
          </div>

          {/* Description skeleton */}
          <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
            <div className="h-3 w-12 rounded skeleton-shimmer mb-3" />
            <div className="space-y-2">
              <div className="h-4 w-full rounded skeleton-shimmer" style={{ animationDelay: "0.15s" }} />
              <div className="h-4 w-full rounded skeleton-shimmer" style={{ animationDelay: "0.2s" }} />
              <div className="h-4 w-3/4 rounded skeleton-shimmer" style={{ animationDelay: "0.25s" }} />
            </div>
          </div>

          {/* Location skeleton */}
          <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
            <div className="h-3 w-16 rounded skeleton-shimmer mb-3" />
            <div className="h-4 w-40 rounded skeleton-shimmer mb-1" style={{ animationDelay: "0.3s" }} />
            <div className="h-4 w-56 rounded skeleton-shimmer" style={{ animationDelay: "0.35s" }} />
          </div>

          {/* Action buttons skeleton */}
          <div className="mt-8 pt-6 border-t border-[var(--twilight)] flex gap-3">
            <div className="h-10 w-24 rounded skeleton-shimmer" />
            <div className="h-10 w-24 rounded skeleton-shimmer" style={{ animationDelay: "0.05s" }} />
          </div>

          <div className="mt-4 flex gap-3">
            <div className="h-12 w-32 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.1s" }} />
            <div className="h-12 w-36 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.15s" }} />
          </div>
        </div>
      </main>
    </div>
  );
}
