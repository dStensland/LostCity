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
      <h3 id="crisis-heading" className="text-base font-bold text-white mb-3">
        {displayCrisisLabel}
      </h3>
      <div className="flex flex-col sm:flex-row gap-2.5">
        <a
          href="tel:988"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors shadow-sm"
        >
          Call 988 &mdash; {displayCrisisLifeline}
        </a>
        <a
          href="tel:18007154225"
          className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-white/80 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors"
        >
          1-800-715-4225 &mdash; {displayGeorgiaLine}
        </a>
      </div>
      <p className="mt-3.5 text-xs text-white/75 leading-relaxed">
        {displayAttribution}
      </p>
    </footer>
  );
}
