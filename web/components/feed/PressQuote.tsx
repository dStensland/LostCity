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

  if (articleUrl) {
    return (
      <a
        href={articleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block hover:text-[var(--soft)] transition-colors duration-150"
        aria-label={`Read press coverage from ${source}`}
      >
        {inner}
      </a>
    );
  }

  return <div>{inner}</div>;
}

export type { PressQuoteProps };
