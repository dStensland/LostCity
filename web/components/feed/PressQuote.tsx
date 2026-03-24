"use client";

interface PressQuoteProps {
  snippet: string;
  source: string;
  articleUrl?: string;
}

export function PressQuote({ snippet, source, articleUrl }: PressQuoteProps) {
  const inner = (
    <span className="flex items-start gap-1.5 min-w-0">
      <span
        className="text-sm leading-none flex-shrink-0 mt-px"
        style={{ color: "var(--gold)" }}
        aria-hidden="true"
      >
        &ldquo;
      </span>
      <span className="flex flex-col min-w-0">
        <span className="text-xs text-[var(--muted)] italic truncate leading-tight">
          {snippet}
        </span>
        <span className="text-2xs text-[var(--muted)] leading-tight">
          &mdash; {source}
        </span>
      </span>
    </span>
  );

  // Use a <span> instead of <a> to avoid nested-link hydration errors
  // when PressQuote is rendered inside a card that's already a <Link>.
  // The articleUrl opens in a new tab via click handler with stopPropagation
  // so it doesn't trigger the parent card's navigation.
  if (articleUrl) {
    return (
      <span
        role="link"
        tabIndex={0}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.open(articleUrl, "_blank", "noopener,noreferrer");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            window.open(articleUrl, "_blank", "noopener,noreferrer");
          }
        }}
        className="block hover:text-[var(--soft)] transition-colors duration-150 cursor-pointer"
        aria-label={`Read press coverage from ${source}`}
      >
        {inner}
      </span>
    );
  }

  return <div>{inner}</div>;
}

export type { PressQuoteProps };
