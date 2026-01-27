import UnifiedHeader from "@/components/UnifiedHeader";

export default function SettingsLoading() {
  return (
    <div className="min-h-screen">
      <UnifiedHeader />

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Title skeleton */}
        <div className="h-8 w-32 bg-[var(--twilight)] rounded skeleton-shimmer mb-8" />

        {/* Settings cards skeleton */}
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-4 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)]"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-4 w-24 bg-[var(--twilight)] rounded skeleton-shimmer mb-2" />
                  <div className="h-3 w-48 bg-[var(--twilight)] rounded skeleton-shimmer" />
                </div>
                <div className="w-5 h-5 bg-[var(--twilight)] rounded skeleton-shimmer" />
              </div>
            </div>
          ))}

          {/* Account info skeleton */}
          <div className="p-4 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)]">
            <div className="h-4 w-20 bg-[var(--twilight)] rounded skeleton-shimmer mb-2" />
            <div className="h-3 w-40 bg-[var(--twilight)] rounded skeleton-shimmer mb-1" />
            <div className="h-3 w-32 bg-[var(--twilight)] rounded skeleton-shimmer" />
          </div>
        </div>
      </main>
    </div>
  );
}
