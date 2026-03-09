import { phoneHref } from "@/lib/concierge/concierge-types";
import type { AgentNarrative } from "@/lib/concierge/concierge-types";

interface AgentFooterProps {
  narrative: AgentNarrative | null;
  conciergePhone: string;
}

export default function AgentFooter({ narrative, conciergePhone }: AgentFooterProps) {
  return (
    <footer className="mt-12">
      <div className="bg-[var(--hotel-charcoal)] rounded-2xl p-6 md:p-8 text-center space-y-5">
        {narrative && (
          <div className="bg-white/10 border border-white/10 rounded-xl p-5 text-left space-y-2 mb-2">
            <h3 className="font-display text-lg text-white">{narrative.briefingTitle}</h3>
            <p className="font-body text-sm text-white/70 leading-relaxed">{narrative.summary}</p>
          </div>
        )}
        <div className="space-y-3">
          <p className="font-body text-sm text-white/70">
            Need help? Your concierge is always available.
          </p>
          <a
            href={phoneHref(conciergePhone)}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-white text-[var(--hotel-charcoal)] font-body font-semibold text-sm hover:bg-[var(--hotel-cream)] transition-all"
          >
            Call Concierge: {conciergePhone}
          </a>
        </div>
      </div>
    </footer>
  );
}
