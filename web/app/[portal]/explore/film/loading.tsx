export default function Loading() {
  return (
    <main className="max-w-screen-xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-16 space-y-6">
      <div className="h-4 w-48 bg-[var(--twilight)] rounded animate-pulse" />
      <div className="h-12 w-2/3 bg-[var(--twilight)] rounded animate-pulse" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="w-[88px] h-[86px] rounded-card bg-[var(--twilight)] animate-pulse" />
        ))}
      </div>
      <div className="h-[300px] rounded-card bg-[var(--twilight)] animate-pulse" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 rounded-card-xl bg-[var(--twilight)] animate-pulse" />
        ))}
      </div>
    </main>
  );
}
