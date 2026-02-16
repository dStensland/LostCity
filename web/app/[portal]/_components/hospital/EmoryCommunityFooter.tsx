type EmoryCommunityFooterProps = {
  sourceCount: number;
  crisisLabel?: string;
  crisisLifelineName?: string;
  georgiaCrisisLineName?: string;
  attributionText?: string;
};

export default function EmoryCommunityFooter({
  sourceCount,
  crisisLabel,
  crisisLifelineName,
  georgiaCrisisLineName,
  attributionText,
}: EmoryCommunityFooterProps) {
  const displayCrisisLabel = crisisLabel || "In crisis?";
  const displayCrisisLifeline = crisisLifelineName || "Suicide & Crisis Lifeline";
  const displayGeorgiaLine = georgiaCrisisLineName || "Georgia Crisis Line";
  const displayAttribution = attributionText?.replace("{count}", String(sourceCount))
    || `Powered by ${sourceCount} verified community sources across Atlanta — hospitals, nonprofits, public health agencies, and peer support organizations.`;

  return (
    <footer className="emory-crisis-footer mt-4" role="region" aria-labelledby="crisis-heading">
      <h3 id="crisis-heading" className="text-base font-bold text-[var(--cream)] mb-3">
        {displayCrisisLabel}
      </h3>
      <div className="flex flex-col sm:flex-row gap-2">
        <a
          href="tel:988"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 transition-colors"
        >
          Call 988 — {displayCrisisLifeline}
        </a>
        <a
          href="tel:18007154225"
          className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-[var(--cream)] px-4 py-2.5 text-sm font-bold text-[var(--cream)] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cream)] transition-colors"
        >
          1-800-715-4225 — {displayGeorgiaLine}
        </a>
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">
        {displayAttribution}
      </p>
    </footer>
  );
}
