import Link from "next/link";
import { ReactNode } from "react";

interface HotelSectionProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  id?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

/**
 * Section wrapper for hotel feed
 * Provides consistent spacing and typography
 */
export default function HotelSection({ title, subtitle, children, className = "", id, action }: HotelSectionProps) {
  return (
    <section className={`${className}`} id={id}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display font-semibold text-2xl md:text-3xl text-[var(--hotel-charcoal)] tracking-tight mb-2">
            {title}
          </h2>
          {subtitle && (
            <p className="font-body text-base text-[var(--hotel-stone)] leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {action && (
          action.href ? (
            <Link
              href={action.href}
              className="flex-shrink-0 text-xs font-body uppercase tracking-[0.15em] text-[var(--hotel-champagne)] hover:text-[var(--hotel-brass)] transition-colors"
            >
              {action.label} &rarr;
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="flex-shrink-0 text-xs font-body uppercase tracking-[0.15em] text-[var(--hotel-champagne)] hover:text-[var(--hotel-brass)] transition-colors"
            >
              {action.label} &rarr;
            </button>
          )
        )}
      </div>
      {children}
    </section>
  );
}
