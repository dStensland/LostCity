"use client";

/**
 * CityPulseSection — section router that delegates rendering
 * to section-specific components.
 *
 * Dispatches: trending, coming_up, weather_discovery, browse.
 * Time-based sections are absorbed into LineupSection.
 */

import type {
  CityPulseSection as CityPulseSectionData,
  PersonalizationMeta,
} from "@/lib/city-pulse/types";
import WeatherDiscoverySection from "./sections/WeatherDiscoverySection";
import TrendingSection from "./sections/TrendingSection";
import ComingUpSection from "./sections/ComingUpSection";
import BrowseSection from "./sections/BrowseSection";
import ConversionCard from "./ConversionCard";

interface CityPulseSectionProps {
  section: CityPulseSectionData;
  portalSlug: string;
  personalization: PersonalizationMeta | null;
  excludeEventIds?: Set<number>;
}

export default function CityPulseSection({
  section,
  portalSlug,
  excludeEventIds,
}: CityPulseSectionProps) {
  if (section.items.length === 0 && section.type !== "browse") {
    return null;
  }

  const sectionContent = (() => {
    switch (section.type) {
      case "weather_discovery":
        return <WeatherDiscoverySection section={section} portalSlug={portalSlug} />;
      case "trending":
        return <TrendingSection section={section} portalSlug={portalSlug} />;
      case "coming_up":
        return <ComingUpSection section={section} portalSlug={portalSlug} excludeEventIds={excludeEventIds} />;
      case "browse":
        return <BrowseSection section={section} portalSlug={portalSlug} />;
      default:
        return null;
    }
  })();

  if (!sectionContent) return null;

  const conversionItem = section.items.find(
    (i) => i.item_type === "conversion_prompt",
  );

  return (
    <div>
      {sectionContent}
      {conversionItem && conversionItem.item_type === "conversion_prompt" && (
        <div className="mt-3">
          <ConversionCard conversion={conversionItem.conversion} />
        </div>
      )}
    </div>
  );
}
