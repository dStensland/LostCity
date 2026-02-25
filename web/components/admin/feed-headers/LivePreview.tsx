"use client";

/**
 * LivePreview — Renders the actual GreetingBar in a phone-width frame
 * using synthetic ResolvedHeader from editor state.
 */

import GreetingBar from "@/components/feed/GreetingBar";
import { getCityPhoto, getEditorialHeadline, getDefaultAccentColor } from "@/lib/city-pulse/header-defaults";
import { getDashboardCards } from "@/lib/city-pulse/dashboard-cards";
import type { ResolvedHeader, FeedContext, TimeSlot, LayoutVariant, TextTreatment } from "@/lib/city-pulse/types";
import { resolveTemplateVars, type HeaderFormData } from "@/lib/admin/feed-header-utils";

interface LivePreviewProps {
  formData: HeaderFormData;
  day: string;
  slot: string;
  portalSlug: string;
}

/** Build a minimal FeedContext for preview purposes. */
function buildPreviewContext(day: string, slot: string): FeedContext {
  return {
    time_slot: slot as TimeSlot,
    day_of_week: day,
    weather: { temperature_f: 72, condition: "Clear", icon: "clear-day" },
    active_holidays: [],
    active_festivals: [],
    quick_links: [],
    day_theme: undefined,
    weather_signal: undefined,
  };
}

export default function LivePreview({
  formData,
  day,
  slot,
  portalSlug,
}: LivePreviewProps) {
  const context = buildPreviewContext(day, slot);

  // Resolve template variables for preview
  const templateVars: Record<string, string> = {
    display_name: "Alex",
    city_name: "Atlanta",
    day_theme: context.day_theme?.replace(/_/g, " ") ?? "",
    weather_label: context.weather?.condition ?? "Clear",
    time_label: slot.replace(/_/g, " "),
  };

  // Build ResolvedHeader from form state, falling back to algorithm defaults
  const headline = formData.headline
    ? resolveTemplateVars(formData.headline, templateVars)
    : getEditorialHeadline(context);

  const heroImage = formData.hero_image_url || getCityPhoto(slot as TimeSlot);
  const accentColor = formData.accent_color || getDefaultAccentColor(context);

  const dashboardCards =
    formData.dashboard_cards.length > 0
      ? formData.dashboard_cards.map((c) => ({
          ...c,
          value: c.value || "",
        }))
      : getDashboardCards(context, portalSlug);

  const quickLinks = formData.quick_links.length > 0 ? formData.quick_links : [];

  const cta =
    formData.cta_label && formData.cta_href
      ? { label: formData.cta_label, href: formData.cta_href, style: formData.cta_style }
      : undefined;

  const resolvedHeader: ResolvedHeader = {
    config_id: null,
    config_slug: null,
    headline,
    subtitle: formData.subtitle || undefined,
    hero_image_url: heroImage,
    accent_color: accentColor,
    layout_variant: (formData.layout_variant as LayoutVariant) || null,
    text_treatment: (formData.text_treatment as TextTreatment) || null,
    dashboard_cards: dashboardCards,
    quick_links: quickLinks,
    cta,
    events_pulse: { total_active: 42, trending_event: "Preview mode" },
    suppressed_event_ids: [],
    boosted_event_ids: [],
  };

  return (
    <div className="space-y-2">
      <h3 className="font-mono text-2xs uppercase tracking-wider text-[var(--muted)]">
        Live Preview
      </h3>
      <div
        className="border border-[var(--twilight)] bg-[var(--void)] overflow-hidden mx-auto"
        style={{ maxWidth: 390 }}
      >
        <div className="p-3">
          <GreetingBar
            header={resolvedHeader}
            context={context}
            portalSlug={portalSlug}
          />
        </div>
      </div>
    </div>
  );
}
