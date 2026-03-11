import type { YonderStayUnitType } from "@/config/yonder-destination-intelligence";

export type YonderInventoryProviderId =
  | "ga_state_parks"
  | "unicoi_lodge"
  | "whitewater_express"
  | "self_guided";

export type YonderInventoryCoverageLevel =
  | "coarse_unit_mix"
  | "package_only"
  | "self_guided";

export type YonderInventoryIntegrationStatus =
  | "manual_link"
  | "operator_checkout"
  | "self_guided";

export type YonderUnitInventoryBand = "limited" | "moderate" | "broad";

export type YonderInventoryProvider = {
  id: YonderInventoryProviderId;
  label: string;
  shortLabel: string;
  inventorySurface: "official_booking" | "operator_booking" | "self_guided";
  providerHasLiveAvailability: boolean;
  providerHasPriceDiscovery: boolean;
  note: string;
};

export type YonderInventoryUnitSummary = {
  unitType: YonderStayUnitType;
  label: string;
  inventoryBand: YonderUnitInventoryBand;
  reservable: boolean;
  priceSignal: "$" | "$$" | "$$$" | null;
  note: string;
};

export type YonderAccommodationInventorySource = {
  slug: string;
  providerId: YonderInventoryProviderId;
  coverageLevel: YonderInventoryCoverageLevel;
  integrationStatus: YonderInventoryIntegrationStatus;
  comparisonAxis:
    | "campground_vs_cabin"
    | "campground_vs_lodge"
    | "guide_package"
    | "self_guided_day_use";
  sourceNote: string;
  unitSummaries: YonderInventoryUnitSummary[];
};

export const YONDER_INVENTORY_PROVIDERS: Record<
  YonderInventoryProviderId,
  YonderInventoryProvider
> = {
  ga_state_parks: {
    id: "ga_state_parks",
    label: "Georgia State Parks",
    shortLabel: "GA State Parks",
    inventorySurface: "official_booking",
    providerHasLiveAvailability: true,
    providerHasPriceDiscovery: true,
    note:
      "Official state-park booking surface with unit selection and date-based inventory, but Yonder is still manual-link only.",
  },
  unicoi_lodge: {
    id: "unicoi_lodge",
    label: "Unicoi Lodge / State Park",
    shortLabel: "Unicoi Lodge",
    inventorySurface: "operator_booking",
    providerHasLiveAvailability: true,
    providerHasPriceDiscovery: true,
    note:
      "Hybrid lodge-and-park operator flow with multiple stay modes surfaced on the destination site.",
  },
  whitewater_express: {
    id: "whitewater_express",
    label: "Whitewater Express",
    shortLabel: "Whitewater Express",
    inventorySurface: "operator_booking",
    providerHasLiveAvailability: true,
    providerHasPriceDiscovery: true,
    note:
      "Operator-led booking flow where the meaningful inventory object is the adventure package, not a campsite or room block.",
  },
  self_guided: {
    id: "self_guided",
    label: "Self-Planned",
    shortLabel: "Self-Planned",
    inventorySurface: "self_guided",
    providerHasLiveAvailability: false,
    providerHasPriceDiscovery: false,
    note:
      "No bookable overnight inventory. The trip is a self-guided objective rather than an accommodation-driven plan.",
  },
};

function buildStateParkInventorySource(
  slug: string,
  sourceNote: string,
  options?: {
    tentBand?: YonderUnitInventoryBand;
    cabinBand?: YonderUnitInventoryBand;
    rvBand?: YonderUnitInventoryBand;
    includeRv?: boolean;
  },
): YonderAccommodationInventorySource {
  const tentBand = options?.tentBand ?? "moderate";
  const cabinBand = options?.cabinBand ?? "limited";
  const includeRv = options?.includeRv ?? false;
  const rvBand = options?.rvBand ?? "limited";

  return {
    slug,
    providerId: "ga_state_parks",
    coverageLevel: "coarse_unit_mix",
    integrationStatus: "manual_link",
    comparisonAxis: "campground_vs_cabin",
    sourceNote,
    unitSummaries: [
      {
        unitType: "tent_site",
        label: "Campground",
        inventoryBand: tentBand,
        reservable: true,
        priceSignal: "$",
        note:
          "Core bookable state-park camping inventory. Treat as the main overnight option for comparison.",
      },
      ...(includeRv
        ? [
            {
              unitType: "rv_site" as const,
              label: "RV / Trailer Pads",
              inventoryBand: rvBand,
              reservable: true,
              priceSignal: "$$",
              note:
                "Present in the official park inventory flow, but still secondary to campsite-first Yonder framing.",
            },
          ]
        : []),
      {
        unitType: "cabin",
        label: "Cabins",
        inventoryBand: cabinBand,
        reservable: true,
        priceSignal: "$$$",
        note:
          "Higher-friction, lower-count overnight option that usually needs more lead time than campground inventory.",
      },
    ],
  };
}

export const YONDER_ACCOMMODATION_INVENTORY_SOURCES: YonderAccommodationInventorySource[] =
  [
    buildStateParkInventorySource(
      "cloudland-canyon",
      "Use the official state-park inventory as the source of truth. Compare Cloudland mostly on canyon payoff versus campground/cabin friction.",
      { tentBand: "broad", cabinBand: "limited", includeRv: true },
    ),
    {
      slug: "springer-mountain",
      providerId: "self_guided",
      coverageLevel: "self_guided",
      integrationStatus: "self_guided",
      comparisonAxis: "self_guided_day_use",
      sourceNote:
        "Springer is an objective, not an accommodation product. Any overnight setup is user-assembled rather than provider-backed.",
      unitSummaries: [
        {
          unitType: "day_use",
          label: "Trail Objective",
          inventoryBand: "broad",
          reservable: false,
          priceSignal: null,
          note:
            "No bookable stay inventory in scope for Yonder today. Position as a self-planned hike or backpacking objective.",
        },
      ],
    },
    buildStateParkInventorySource(
      "vogel-state-park",
      "State-park inventory is the operative source. Vogel works best as a campground-versus-cabin weekend comparison with lake access upside.",
      { tentBand: "broad", cabinBand: "moderate", includeRv: true },
    ),
    buildStateParkInventorySource(
      "fort-mountain-state-park",
      "Compare Fort Mountain through the state-park booking surface, with campground inventory leading and cabins as the lower-count comfort option.",
      { tentBand: "moderate", cabinBand: "limited", includeRv: true },
    ),
    buildStateParkInventorySource(
      "black-rock-mountain",
      "Use the state-park booking flow as the operative inventory layer. The main comparison is mountain scenery versus tighter overnight supply.",
      { tentBand: "moderate", cabinBand: "limited", includeRv: true },
    ),
    {
      slug: "cohutta-overlook",
      providerId: "self_guided",
      coverageLevel: "self_guided",
      integrationStatus: "self_guided",
      comparisonAxis: "self_guided_day_use",
      sourceNote:
        "Cohutta Overlook is a scenic objective with no first-class stay inventory attached to the anchor itself.",
      unitSummaries: [
        {
          unitType: "day_use",
          label: "Scenic Objective",
          inventoryBand: "broad",
          reservable: false,
          priceSignal: null,
          note:
            "Treat as self-guided overlook access. Overnight planning sits outside the current Yonder inventory model.",
        },
      ],
    },
    buildStateParkInventorySource(
      "chattahoochee-bend-state-park",
      "State-park inventory is the source of truth, with camping carrying more weight than cabins in the weekend comparison.",
      { tentBand: "moderate", cabinBand: "limited", includeRv: true },
    ),
    {
      slug: "whitewater-express-columbus",
      providerId: "whitewater_express",
      coverageLevel: "package_only",
      integrationStatus: "operator_checkout",
      comparisonAxis: "guide_package",
      sourceNote:
        "The provider-backed inventory object is the guided rafting package. Compare this against park weekends as an operator-led escape, not a lodging-first trip.",
      unitSummaries: [
        {
          unitType: "guide_package",
          label: "Rafting Packages",
          inventoryBand: "moderate",
          reservable: true,
          priceSignal: "$$$",
          note:
            "Adventure-package inventory with explicit operator checkout. Lodging is secondary and external to the current Yonder model.",
        },
      ],
    },
    buildStateParkInventorySource(
      "red-top-mountain-state-park",
      "Use the state-park booking surface for comparison. Red Top has a broader all-around overnight mix than the more remote mountain parks.",
      { tentBand: "broad", cabinBand: "moderate", includeRv: true, rvBand: "moderate" },
    ),
    buildStateParkInventorySource(
      "hard-labor-creek-state-park",
      "State-park inventory is the operative booking layer. Compare mostly on lower-friction campground weekends with a cabin fallback.",
      { tentBand: "moderate", cabinBand: "limited", includeRv: true },
    ),
    buildStateParkInventorySource(
      "fort-yargo-state-park",
      "The booking source is the official state-park inventory, with a balanced campground/cabin weekend profile.",
      { tentBand: "broad", cabinBand: "moderate", includeRv: true, rvBand: "moderate" },
    ),
    buildStateParkInventorySource(
      "don-carter-state-park",
      "Use the state-park booking flow as the comparison surface. This weekend is strongest when framed as lake access plus campground/cabin choice.",
      { tentBand: "moderate", cabinBand: "moderate", includeRv: true },
    ),
    {
      slug: "unicoi-state-park",
      providerId: "unicoi_lodge",
      coverageLevel: "coarse_unit_mix",
      integrationStatus: "manual_link",
      comparisonAxis: "campground_vs_lodge",
      sourceNote:
        "Unicoi has the broadest overnight mix in the current Yonder set, spanning campground, cabins, and lodge rooms through a hybrid park/lodge surface.",
      unitSummaries: [
        {
          unitType: "lodge_room",
          label: "Lodge Rooms",
          inventoryBand: "moderate",
          reservable: true,
          priceSignal: "$$$",
          note:
            "Main comfort-first inventory for users who want a weekend anchor without campsite logistics.",
        },
        {
          unitType: "cabin",
          label: "Cabins",
          inventoryBand: "limited",
          reservable: true,
          priceSignal: "$$$",
          note:
            "Higher-demand park stay mode with stronger lead-time pressure than standard rooms.",
        },
        {
          unitType: "tent_site",
          label: "Campground",
          inventoryBand: "moderate",
          reservable: true,
          priceSignal: "$$",
          note:
            "Lower-cost overnight mode that lets Unicoi compete with other state-park weekends on value.",
        },
      ],
    },
  ];

export const YONDER_ACCOMMODATION_INVENTORY_BY_SLUG = Object.fromEntries(
  YONDER_ACCOMMODATION_INVENTORY_SOURCES.map((item) => [item.slug, item]),
) as Record<string, YonderAccommodationInventorySource>;

export function getYonderAccommodationInventorySource(
  slug: string | null | undefined,
): YonderAccommodationInventorySource | null {
  if (!slug) return null;
  return YONDER_ACCOMMODATION_INVENTORY_BY_SLUG[slug] ?? null;
}
