export type DayPart = "morning" | "afternoon" | "evening" | "night";

export function getDayPart(): DayPart {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export function getHappeningNowGreeting(
  dayPart: DayPart,
  eventCount: number,
  spotCount: number,
  hasGps = false,
): { headline: string; subtitle: string } {
  const locationSuffix = hasGps ? "around you" : "in Atlanta";

  switch (dayPart) {
    case "morning":
      return {
        headline: "Good morning",
        subtitle: `${spotCount} ${spotCount === 1 ? "spot" : "spots"} open ${locationSuffix}`,
      };
    case "afternoon":
      return {
        headline: "This afternoon",
        subtitle: `${eventCount} ${eventCount === 1 ? "event" : "events"} live, ${spotCount} ${spotCount === 1 ? "spot" : "spots"} open ${locationSuffix}`,
      };
    case "evening":
      return {
        headline: "Tonight",
        subtitle: `${eventCount} ${eventCount === 1 ? "event" : "events"} live, ${spotCount} ${spotCount === 1 ? "spot" : "spots"} open ${locationSuffix}`,
      };
    case "night":
      return {
        headline: "Late night",
        subtitle: `${spotCount} ${spotCount === 1 ? "spot" : "spots"} still open ${locationSuffix}`,
      };
  }
}
