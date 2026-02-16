import type { ShowSignals } from "@/lib/show-signals";

type SignalItem = {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
  href?: string | null;
};

interface ShowSignalsPanelProps {
  signals: ShowSignals;
  className?: string;
  ticketUrl?: string | null;
}

const TONE_CLASS: Record<NonNullable<SignalItem["tone"]>, string> = {
  default: "text-[var(--cream)]",
  success: "text-[var(--neon-green)]",
  warning: "text-[var(--gold)]",
  danger: "text-[var(--coral)]",
};

export default function ShowSignalsPanel({ signals, className = "", ticketUrl = null }: ShowSignalsPanelProps) {
  const items: SignalItem[] = [];

  if (signals.showTime) {
    items.push({ label: "Show", value: signals.showTime });
  }
  if (signals.doorsTime) {
    items.push({ label: "Doors", value: signals.doorsTime });
  }
  if (signals.endTime) {
    items.push({ label: "Ends", value: signals.endTime });
  }
  if (signals.agePolicy) {
    items.push({ label: "Ages", value: signals.agePolicy });
  }
  if (signals.ticketStatus) {
    const tone =
      signals.ticketStatus === "Sold out"
        ? "danger"
        : signals.ticketStatus === "Low tickets"
          ? "warning"
          : signals.ticketStatus === "Free"
            ? "success"
            : "default";
    const shouldLink =
      Boolean(ticketUrl) &&
      (signals.ticketStatus === "Tickets available" || signals.ticketStatus === "Low tickets");
    items.push({
      label: "Tickets",
      value: signals.ticketStatus,
      tone,
      href: shouldLink ? ticketUrl : null,
    });
  }
  if (signals.reentryPolicy) {
    items.push({ label: "Re-entry", value: signals.reentryPolicy });
  }
  if (signals.hasSetTimesMention) {
    items.push({ label: "Set Times", value: "Mentioned" });
  }

  if (items.length === 0) return null;

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 ${className}`}>
      {items.map((item) => (
        <div
          key={`${item.label}-${item.value}`}
          className="rounded-lg border border-[var(--twilight)] bg-[var(--void)]/70 px-3 py-2"
        >
          <div className="font-mono text-[0.58rem] uppercase tracking-widest text-[var(--muted)]">
            {item.label}
          </div>
          {item.href ? (
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm font-medium transition-colors hover:bg-[var(--twilight)]/30 ${TONE_CLASS[item.tone || "default"]} border-current/30`}
              aria-label={`Open tickets page: ${item.value}`}
            >
              {item.value}
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5h5m0 0v5m0-5L10 14" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 9v10h10" />
              </svg>
            </a>
          ) : (
            <div className={`text-sm font-medium ${TONE_CLASS[item.tone || "default"]}`}>
              {item.value}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
