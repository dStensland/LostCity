"use client";

/**
 * DetailFieldsets — Collapsible sections for dashboard cards,
 * quick links, CTA, and event moderation.
 */

import { ICON_OPTIONS, type HeaderFormData } from "@/lib/admin/feed-header-utils";

interface DetailFieldsetsProps {
  formData: HeaderFormData;
  onChange: (update: Partial<HeaderFormData>) => void;
}

export default function DetailFieldsets({
  formData,
  onChange,
}: DetailFieldsetsProps) {
  return (
    <div className="space-y-3">
      {/* Dashboard Cards */}
      <details className="rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)] overflow-hidden">
        <summary className="px-4 py-3 cursor-pointer font-mono text-xs uppercase tracking-wider text-[var(--muted)] hover:text-[var(--cream)] transition-colors">
          Dashboard Cards ({formData.dashboard_cards.length}/6)
        </summary>
        <div className="px-4 pb-4 space-y-3">
          {formData.dashboard_cards.map((card, i) => (
            <div
              key={i}
              className="border border-[var(--twilight)] rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[0.625rem] text-[var(--muted)]">
                  Card {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      dashboard_cards: formData.dashboard_cards.filter(
                        (_, j) => j !== i
                      ),
                    })
                  }
                  className="font-mono text-[0.625rem] text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  placeholder="Label"
                  value={card.label}
                  onChange={(e) => {
                    const updated = [...formData.dashboard_cards];
                    updated[i] = { ...updated[i], label: e.target.value };
                    onChange({ dashboard_cards: updated });
                  }}
                  className="px-2 py-1 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-[0.625rem] text-[var(--cream)]"
                />
                <select
                  value={card.icon}
                  onChange={(e) => {
                    const updated = [...formData.dashboard_cards];
                    updated[i] = { ...updated[i], icon: e.target.value };
                    onChange({ dashboard_cards: updated });
                  }}
                  className="px-2 py-1 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-[0.625rem] text-[var(--cream)]"
                >
                  <option value="">Icon...</option>
                  {ICON_OPTIONS.map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Value"
                  value={card.value || ""}
                  onChange={(e) => {
                    const updated = [...formData.dashboard_cards];
                    updated[i] = { ...updated[i], value: e.target.value };
                    onChange({ dashboard_cards: updated });
                  }}
                  className="px-2 py-1 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-[0.625rem] text-[var(--cream)]"
                />
              </div>
              <input
                placeholder="href (e.g. /atlanta?view=find&type=events)"
                value={card.href}
                onChange={(e) => {
                  const updated = [...formData.dashboard_cards];
                  updated[i] = { ...updated[i], href: e.target.value };
                  onChange({ dashboard_cards: updated });
                }}
                className="w-full px-2 py-1 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-[0.625rem] text-[var(--cream)]"
              />
              <details className="text-xs">
                <summary className="font-mono text-[var(--muted)] cursor-pointer text-[0.625rem]">
                  Live count query
                </summary>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <select
                    value={card.query?.entity || ""}
                    onChange={(e) => {
                      const updated = [...formData.dashboard_cards];
                      const entity = e.target.value as
                        | "events"
                        | "venues"
                        | "";
                      updated[i] = {
                        ...updated[i],
                        query: entity
                          ? ({
                              ...updated[i].query,
                              entity,
                            } as typeof card.query)
                          : undefined,
                      };
                      onChange({ dashboard_cards: updated });
                    }}
                    className="px-2 py-1 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-[0.625rem] text-[var(--cream)]"
                  >
                    <option value="">No query</option>
                    <option value="events">Events</option>
                    <option value="venues">Venues</option>
                  </select>
                  <input
                    placeholder="category"
                    value={card.query?.category || ""}
                    onChange={(e) => {
                      const updated = [...formData.dashboard_cards];
                      if (updated[i].query) {
                        updated[i] = {
                          ...updated[i],
                          query: {
                            ...updated[i].query!,
                            category: e.target.value || undefined,
                          },
                        };
                      }
                      onChange({ dashboard_cards: updated });
                    }}
                    className="px-2 py-1 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-[0.625rem] text-[var(--cream)]"
                  />
                  <select
                    value={card.query?.date_filter || ""}
                    onChange={(e) => {
                      const updated = [...formData.dashboard_cards];
                      if (updated[i].query) {
                        updated[i] = {
                          ...updated[i],
                          query: {
                            ...updated[i].query!,
                            date_filter: e.target.value || undefined,
                          },
                        };
                      }
                      onChange({ dashboard_cards: updated });
                    }}
                    className="px-2 py-1 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-[0.625rem] text-[var(--cream)]"
                  >
                    <option value="">Date filter...</option>
                    <option value="today">Today</option>
                    <option value="tomorrow">Tomorrow</option>
                    <option value="this_weekend">This weekend</option>
                    <option value="this_week">This week</option>
                  </select>
                </div>
              </details>
            </div>
          ))}
          {formData.dashboard_cards.length < 6 && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  dashboard_cards: [
                    ...formData.dashboard_cards,
                    {
                      id: `card-${Date.now()}`,
                      label: "",
                      icon: "",
                      href: "",
                    },
                  ],
                })
              }
              className="px-3 py-1.5 font-mono text-[0.625rem] rounded border border-dashed border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--cream)]/30"
            >
              + Add card
            </button>
          )}
        </div>
      </details>

      {/* Quick Links */}
      <details className="rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)] overflow-hidden">
        <summary className="px-4 py-3 cursor-pointer font-mono text-xs uppercase tracking-wider text-[var(--muted)] hover:text-[var(--cream)] transition-colors">
          Quick Links ({formData.quick_links.length}/8)
        </summary>
        <div className="px-4 pb-4 space-y-2">
          {formData.quick_links.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                placeholder="Label"
                value={link.label}
                onChange={(e) => {
                  const updated = [...formData.quick_links];
                  updated[i] = { ...updated[i], label: e.target.value };
                  onChange({ quick_links: updated });
                }}
                className="flex-1 px-2 py-1 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-[0.625rem] text-[var(--cream)]"
              />
              <input
                placeholder="href"
                value={link.href}
                onChange={(e) => {
                  const updated = [...formData.quick_links];
                  updated[i] = { ...updated[i], href: e.target.value };
                  onChange({ quick_links: updated });
                }}
                className="flex-1 px-2 py-1 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-[0.625rem] text-[var(--cream)]"
              />
              <select
                value={link.icon}
                onChange={(e) => {
                  const updated = [...formData.quick_links];
                  updated[i] = { ...updated[i], icon: e.target.value };
                  onChange({ quick_links: updated });
                }}
                className="px-2 py-1 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-[0.625rem] text-[var(--cream)] w-24"
              >
                <option value="">Icon</option>
                {ICON_OPTIONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    quick_links: formData.quick_links.filter(
                      (_, j) => j !== i
                    ),
                  })
                }
                className="font-mono text-[0.625rem] text-red-400 hover:text-red-300"
              >
                x
              </button>
            </div>
          ))}
          {formData.quick_links.length < 8 && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  quick_links: [
                    ...formData.quick_links,
                    {
                      label: "",
                      icon: "Storefront",
                      href: "",
                      accent_color: "var(--coral)",
                    },
                  ],
                })
              }
              className="px-3 py-1.5 font-mono text-[0.625rem] rounded border border-dashed border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--cream)]/30"
            >
              + Add link
            </button>
          )}
        </div>
      </details>

      {/* CTA */}
      <details className="rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)] overflow-hidden">
        <summary className="px-4 py-3 cursor-pointer font-mono text-xs uppercase tracking-wider text-[var(--muted)] hover:text-[var(--cream)] transition-colors">
          CTA Button {formData.cta_label ? `(${formData.cta_label})` : "(none)"}
        </summary>
        <div className="px-4 pb-4">
          <div className="grid grid-cols-3 gap-2">
            <input
              placeholder="Label"
              value={formData.cta_label}
              onChange={(e) => onChange({ cta_label: e.target.value })}
              className="px-2 py-1.5 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-[0.625rem] text-[var(--cream)]"
            />
            <input
              placeholder="href"
              value={formData.cta_href}
              onChange={(e) => onChange({ cta_href: e.target.value })}
              className="px-2 py-1.5 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-[0.625rem] text-[var(--cream)]"
            />
            <select
              value={formData.cta_style}
              onChange={(e) =>
                onChange({
                  cta_style: e.target.value as "primary" | "ghost",
                })
              }
              className="px-2 py-1.5 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-[0.625rem] text-[var(--cream)]"
            >
              <option value="primary">Primary</option>
              <option value="ghost">Ghost</option>
            </select>
          </div>
        </div>
      </details>

      {/* Event Moderation */}
      <details className="rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)] overflow-hidden">
        <summary className="px-4 py-3 cursor-pointer font-mono text-xs uppercase tracking-wider text-[var(--muted)] hover:text-[var(--cream)] transition-colors">
          Event Moderation
        </summary>
        <div className="px-4 pb-4 space-y-3">
          <div className="space-y-1">
            <span className="font-mono text-[0.5625rem] text-[var(--muted)]">
              Suppressed event IDs (comma-separated)
            </span>
            <input
              type="text"
              value={formData.suppressed_event_ids}
              onChange={(e) =>
                onChange({ suppressed_event_ids: e.target.value })
              }
              placeholder="123, 456, 789"
              className="w-full px-2 py-1.5 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-[0.625rem] text-[var(--cream)]"
            />
          </div>
          <div className="space-y-1">
            <span className="font-mono text-[0.5625rem] text-[var(--muted)]">
              Boosted event IDs (comma-separated)
            </span>
            <input
              type="text"
              value={formData.boosted_event_ids}
              onChange={(e) =>
                onChange({ boosted_event_ids: e.target.value })
              }
              placeholder="123, 456"
              className="w-full px-2 py-1.5 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-[0.625rem] text-[var(--cream)]"
            />
          </div>
        </div>
      </details>
    </div>
  );
}
