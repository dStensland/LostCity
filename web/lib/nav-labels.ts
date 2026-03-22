export type PortalNavLabels = {
  feed?: string;
  find?: string;
  happening?: string;
  places?: string;
  community?: string;
  support?: string;
  groups?: string;
  events?: string;
  spots?: string;
  [key: string]: string | undefined;
};

export type PortalNavKey = "feed" | "find" | "happening" | "places" | "community" | "support" | "events" | "spots";

export function getPortalNavLabel(
  navLabels: PortalNavLabels,
  key: PortalNavKey,
  defaultLabel: string,
): string {
  if (key === "feed") {
    return navLabels.feed || defaultLabel;
  }

  if (key === "happening") {
    return navLabels.happening || navLabels.find || navLabels.events || defaultLabel;
  }

  if (key === "places") {
    return navLabels.places || navLabels.spots || defaultLabel;
  }

  if (key === "find") {
    return navLabels.find || navLabels.events || defaultLabel;
  }

  if (key === "community") {
    return navLabels.community || navLabels.groups || defaultLabel;
  }

  if (key === "support") {
    return navLabels.support || defaultLabel;
  }

  if (key === "events") {
    return navLabels.events || navLabels.find || defaultLabel;
  }

  if (key === "spots") {
    return navLabels.spots || defaultLabel;
  }

  return defaultLabel;
}
