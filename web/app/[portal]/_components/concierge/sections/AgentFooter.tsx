import { phoneHref } from "@/lib/concierge/concierge-types";
import type { AgentNarrative } from "@/lib/concierge/concierge-types";

interface AgentFooterProps {
  narrative: AgentNarrative | null;
  conciergePhone: string;
}

export default function AgentFooter({ narrative, conciergePhone }: AgentFooterProps) {
  return (
    <footer className="mt-12 pt-8 border-t border-[var(--hotel-sand)]">
      {narrative && (
        <div className="mb-8 rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-6 space-y-3">
          <h3 className="font-display text-lg text-[var(--hotel-charcoal)]">{narrative.briefingTitle}</h3>
          <p className="text-sm font-body text-[var(--hotel-stone)] leading-relaxed">{narrative.summary}</p>
        </div>
      )}
      <div className="text-center space-y-3">
        <p className="text-sm font-body text-[var(--hotel-stone)]">
          Need help? Your concierge is always available.
        </p>
        <a
          href={phoneHref(conciergePhone)}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--hotel-charcoal)] text-white text-sm font-body hover:bg-[var(--hotel-ink)] transition-all shadow-[0_0_0_0_var(--hotel-charcoal)] hover:shadow-[0_0_20px_-4px_var(--hotel-charcoal)]"
        >
          Call Concierge: {conciergePhone}
        </a>
      </div>
    </footer>
  );
}
