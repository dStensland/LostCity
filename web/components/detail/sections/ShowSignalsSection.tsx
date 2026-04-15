"use client";

import { deriveShowSignals } from "@/lib/show-signals";
import type { SectionProps } from "@/lib/detail/types";

export function ShowSignalsSection({ data }: SectionProps) {
  if (data.entityType !== "event") return null;

  const e = data.payload.event;
  const signals = deriveShowSignals({
    title: e.title,
    description: e.description,
    price_note: e.price_note,
    tags: e.tags,
    start_time: e.start_time,
    doors_time: e.doors_time,
    end_time: e.end_time,
    is_all_day: e.is_all_day,
    is_free: e.is_free,
    ticket_url: e.ticket_url,
    age_policy: e.age_policy,
    ticket_status: e.ticket_status,
    reentry_policy: e.reentry_policy,
    set_times_mentioned: e.set_times_mentioned,
  });

  type SignalItem = {
    label: string;
    value: string;
    tone?: "default" | "success" | "warning" | "danger";
    href?: string | null;
  };

  const items: SignalItem[] = [];

  if (signals.showTime) items.push({ label: "Show", value: signals.showTime });
  if (signals.doorsTime) items.push({ label: "Doors", value: signals.doorsTime });
  if (signals.endTime) items.push({ label: "Ends", value: signals.endTime });
  if (signals.agePolicy) items.push({ label: "Ages", value: signals.agePolicy });
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
      Boolean(e.ticket_url) &&
      (signals.ticketStatus === "Tickets available" || signals.ticketStatus === "Low tickets");
    items.push({
      label: "Tickets",
      value: signals.ticketStatus,
      tone,
      href: shouldLink ? e.ticket_url : null,
    });
  }
  if (signals.reentryPolicy) items.push({ label: "Re-entry", value: signals.reentryPolicy });
  if (signals.hasSetTimesMention) items.push({ label: "Set Times", value: "Mentioned" });

  if (items.length === 0) return null;

  const TONE_CLASS: Record<NonNullable<SignalItem["tone"]>, string> = {
    default: "text-[var(--cream)]",
    success: "text-[var(--neon-green)]",
    warning: "text-[var(--gold)]",
    danger: "text-[var(--coral)]",
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map((item) => (
        <div
          key={`${item.label}-${item.value}`}
          className="rounded-lg border border-[var(--twilight)] bg-[var(--void)]/70 px-3 py-2"
        >
          <div className="font-mono text-2xs uppercase tracking-widest text-[var(--muted)]">
            {item.label}
          </div>
          {item.href ? (
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm font-medium transition-colors hover:bg-[var(--twilight)]/30 ${TONE_CLASS[item.tone || "default"]} border-current/30`}
            >
              {item.value} ↗
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
