export default function PortalExploreLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="rounded-[24px] border border-[var(--twilight)]/30 bg-[linear-gradient(140deg,rgba(10,14,24,0.96),rgba(14,19,30,0.82))] p-5">
        <div className="h-3 w-28 rounded skeleton-shimmer" />
        <div className="mt-3 h-10 w-[52%] rounded skeleton-shimmer" />
        <div className="mt-3 h-4 w-[68%] rounded skeleton-shimmer" />
        <div className="mt-5 h-12 rounded-2xl skeleton-shimmer" />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-44 rounded-[22px] border border-[var(--twilight)]/20 skeleton-shimmer"
            style={{ animationDelay: `${index * 40}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
