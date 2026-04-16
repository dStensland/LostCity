import { type ReactNode } from 'react';

interface ElevatedShellProps {
  hero: ReactNode;
  identity: ReactNode;      // null for typographic tier (identity embedded in hero)
  rail: ReactNode;           // null on mobile (rendered conditionally by caller)
  content: ReactNode;
  bottomBar?: ReactNode;
}

export function ElevatedShell({
  hero,
  identity,
  rail,
  content,
  bottomBar,
}: ElevatedShellProps) {
  return (
    <div className="relative min-h-[100dvh] bg-[var(--void)]">
      {/* Hero — full viewport width */}
      <div className="w-full">{hero}</div>

      {/* Two-column layout below hero */}
      <div className="mx-auto max-w-7xl px-0 lg:px-6">
        <div className="flex flex-col lg:flex-row lg:gap-8">
          {/* Content column */}
          <main className="flex-1 min-w-0">
            {identity && (
              <div
                className="px-4 lg:px-8 pt-6 pb-4 motion-fade-up"
                style={{ animationDelay: "100ms" }}
              >
                {identity}
              </div>
            )}
            <div>{content}</div>
          </main>

          {/* Sticky action rail — desktop only */}
          {rail && (
            <aside className="hidden lg:block lg:w-[300px] lg:flex-shrink-0">
              <div className="sticky top-6 max-h-[calc(100dvh-48px)] overflow-y-auto scrollbar-hide">
                {rail}
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      {bottomBar && (
        <div className="lg:hidden">{bottomBar}</div>
      )}
    </div>
  );
}
