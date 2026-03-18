/**
 * WMO weather code utilities shared across family portal weather hooks.
 * Used by useWeather, useWeekendForecast, and useBreakForecast (all Open-Meteo).
 *
 * WMO Weather Interpretation Codes reference:
 * https://open-meteo.com/en/docs#weathervariables
 */

/**
 * Map a WMO weather code to a human-readable condition string.
 */
export function wmoToCondition(code: number): string {
  if (code === 0) return "Clear";
  if (code >= 1 && code <= 3) return "Partly Cloudy";
  if (code >= 45 && code <= 48) return "Foggy";
  if (code >= 51 && code <= 55) return "Drizzle";
  if (code >= 61 && code <= 65) return "Rainy";
  if (code >= 71 && code <= 77) return "Snowy";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 95 && code <= 99) return "Thunderstorm";
  return "Cloudy";
}

/** Map a condition string (from wmoToCondition) to a display emoji. */
export function conditionToEmoji(condition: string): string {
  switch (condition) {
    case "Clear":         return "☀️";
    case "Partly Cloudy": return "⛅";
    case "Foggy":         return "🌫️";
    case "Drizzle":       return "🌦️";
    case "Rainy":         return "🌧️";
    case "Snowy":         return "❄️";
    case "Showers":       return "🌧️";
    case "Thunderstorm":  return "⛈️";
    default:              return "🌥️";
  }
}

/** Returns true if the condition string indicates precipitation. */
export function isRainyCondition(condition: string): boolean {
  const c = condition.toLowerCase();
  return (
    c.includes("rain") ||
    c.includes("shower") ||
    c.includes("thunder") ||
    c.includes("drizzle")
  );
}
