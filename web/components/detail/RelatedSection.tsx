import { type ReactNode } from "react";
import { SectionHeader } from "./SectionHeader";

export interface RelatedSectionProps {
  title: string;
  count?: number;
  children: ReactNode;
  emptyMessage?: string;
  className?: string;
}

export function RelatedSection({
  title,
  count,
  children,
  emptyMessage = "No items found",
  className = "",
}: RelatedSectionProps) {
  const isEmpty = !children || (Array.isArray(children) && children.length === 0);

  return (
    <section className={className}>
      <SectionHeader title={title} count={count} />

      {isEmpty ? (
        <div className="py-8 text-center">
          <p className="text-sm text-[var(--muted)]">{emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4 snap-x snap-mandatory sm:snap-none">
            {children}
          </div>
        </div>
      )}
    </section>
  );
}
