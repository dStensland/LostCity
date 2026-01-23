"use client";

export default function TonightsPicksSkeleton() {
  return (
    <section className="py-6 -mx-4 px-4 mb-6 relative overflow-hidden">
      {/* Subtle atmospheric background */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, var(--neon-magenta) 0%, transparent 70%)",
        }}
      />

      <div className="relative max-w-3xl mx-auto">
        {/* Section header skeleton */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full skeleton-shimmer" />
          <div>
            <div className="h-5 w-32 rounded skeleton-shimmer mb-1" />
            <div className="h-3 w-44 rounded skeleton-shimmer" style={{ animationDelay: "0.05s" }} />
          </div>
        </div>

        {/* Hero card skeleton */}
        <div
          className="rounded-2xl overflow-hidden mb-4 relative"
          style={{ backgroundColor: "var(--dusk)" }}
        >
          {/* Gradient overlay like real component */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          <div className="relative p-5 pt-32">
            {/* Badges */}
            <div className="flex items-center gap-2 mb-2">
              <div className="h-5 w-16 rounded-full skeleton-shimmer" />
              <div className="h-5 w-14 rounded-full skeleton-shimmer" style={{ animationDelay: "0.05s" }} />
            </div>
            {/* Title */}
            <div className="h-6 w-3/4 rounded skeleton-shimmer mb-2" style={{ animationDelay: "0.1s" }} />
            {/* Meta */}
            <div className="flex items-center gap-2">
              <div className="h-4 w-12 rounded skeleton-shimmer" style={{ animationDelay: "0.15s" }} />
              <div className="h-4 w-24 rounded skeleton-shimmer" style={{ animationDelay: "0.2s" }} />
            </div>
          </div>
        </div>

        {/* Secondary cards skeleton */}
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="p-3 rounded-xl border border-[var(--twilight)]"
              style={{ backgroundColor: "var(--dusk)" }}
            >
              <div className="h-3 w-10 rounded skeleton-shimmer mb-2" style={{ animationDelay: `${i * 0.05 + 0.25}s` }} />
              <div className="h-4 w-full rounded skeleton-shimmer mb-1" style={{ animationDelay: `${i * 0.05 + 0.3}s` }} />
              <div className="h-4 w-2/3 rounded skeleton-shimmer mb-2" style={{ animationDelay: `${i * 0.05 + 0.35}s` }} />
              <div className="h-3 w-1/2 rounded skeleton-shimmer" style={{ animationDelay: `${i * 0.05 + 0.4}s` }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
