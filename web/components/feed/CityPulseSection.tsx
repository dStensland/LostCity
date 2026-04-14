"use client";

/**
 * CityPulseSection — section router that delegates rendering
 * to section-specific components.
 *
 * Dispatches: trending, coming_up, weather_discovery.
 * Time-based sections are absorbed into LineupSection.
 * Browse/places-to-go is rendered directly in CityPulseShell via PlacesToGoSection.
 */

import type {
  CityPulseSection as CityPulseSectionData,
  PersonalizationMeta,
} from "@/lib/city-pulse/types";
import WeatherDiscoverySection from "./sections/WeatherDiscoverySection";
import TrendingSection from "./sections/TrendingSection";
import ComingUpSection from "./sections/ComingUpSection";
import ConversionCard from "./ConversionCard";

interface CityPulseSectionProps {
  section: CityPulseSectionData;
  portalSlug: string;
  personalization: PersonalizationMeta | null;
}

export default function CityPulseSection({
  section,
  portalSlug,
}: CityPulseSectionProps) {
  if (section.items.length === 0) {
    return null;
  }

  const sectionContent = (() => {
    switch (section.type) {
      case "weather_discovery":
        return <WeatherDiscoverySection section={section} portalSlug={portalSlug} />;
      case "trending":
        return <TrendingSection section={section} portalSlug={portalSlug} />;
      case "coming_up":
        return <ComingUpSection section={section} portalSlug={portalSlug} />;
      case "the_scene":
      case "tonights_regulars":
        // Self-fetching — rendered directly in CityPulseShell, not through this generic renderer
        return null;
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
