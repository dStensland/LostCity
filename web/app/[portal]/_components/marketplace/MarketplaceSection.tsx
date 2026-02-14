import { ReactNode } from "react";

interface MarketplaceSectionProps {
  id?: string;
  kicker?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: { label: string; href?: string };
}

export default function MarketplaceSection({
  id,
  kicker,
  title,
  subtitle,
  children,
  className = "",
  action,
}: MarketplaceSectionProps) {
  return (
    <section className={className} id={id}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {kicker && (
            <p className="text-[10px] font-label uppercase tracking-[0.14em] text-[var(--mkt-steel)] mb-1.5">
              {kicker}
            </p>
          )}
          <h2 className="font-display font-semibold text-2xl md:text-3xl text-[var(--mkt-charcoal)] tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="font-body text-sm text-[var(--mkt-steel)] leading-relaxed mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {action && action.href && (
          <a
            href={action.href}
            className="flex-shrink-0 text-xs font-label uppercase tracking-[0.12em] text-[var(--mkt-brick)] hover:text-[var(--mkt-amber)] transition-colors"
          >
            {action.label} &rarr;
          </a>
        )}
      </div>
      {children}
    </section>
  );
}
