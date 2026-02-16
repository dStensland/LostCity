/**
 * Client-safe weather utilities
 * Types, formatters, and ranking signal logic — no server imports
 */

export interface WeatherData {
  temperature_f: number;
  condition: string;
  icon: string;
  humidity: number;
  wind_mph: number;
  fetched_at: string;
}

export type WeatherSignal =
  | "rain"
  | "cold"
  | "nice"
  | "hot"
  | "default";

/**
 * Determine the weather signal from current conditions
 */
export function getWeatherSignal(weather: WeatherData): WeatherSignal {
  const condition = weather.condition.toLowerCase();

  if (
    condition.includes("rain") ||
    condition.includes("drizzle") ||
    condition.includes("thunderstorm")
  ) {
    return "rain";
  }
  if (weather.temperature_f < 45) return "cold";
  if (weather.temperature_f > 85) return "hot";
  if (
    weather.temperature_f >= 65 &&
    weather.temperature_f <= 75 &&
    (condition.includes("clear") || condition.includes("cloud"))
  ) {
    return "nice";
  }
  return "default";
}

/**
 * Venue scoring adjustments based on weather signal
 */
export function getWeatherModifiers(signal: WeatherSignal): {
  indoor: number;
  outdoor: number;
  rooftop: number;
  cozy: number;
} {
  switch (signal) {
    case "rain":
      return { indoor: 0.15, outdoor: -0.25, rooftop: -0.25, cozy: 0.1 };
    case "cold":
      return { indoor: 0.05, outdoor: -0.1, rooftop: -0.2, cozy: 0.1 };
    case "nice":
      return { indoor: 0, outdoor: 0.2, rooftop: 0.2, cozy: 0 };
    case "hot":
      return { indoor: 0.1, outdoor: -0.05, rooftop: -0.1, cozy: 0 };
    default:
      return { indoor: 0, outdoor: 0, rooftop: 0, cozy: 0 };
  }
}

/**
 * Format temperature for display
 */
export function formatTemperature(tempF: number): string {
  return `${Math.round(tempF)}\u00B0`;
}

/**
 * Get a short display string for current weather
 */
export function formatWeatherBadge(weather: WeatherData): string {
  return `${Math.round(weather.temperature_f)}\u00B0 ${capitalizeFirst(weather.condition)}`;
}

/**
 * Get weather icon name for display
 */
export function getWeatherIconName(icon: string): string {
  // OpenWeatherMap icon codes: https://openweathermap.org/weather-conditions
  if (icon.startsWith("01")) return "clear";
  if (icon.startsWith("02")) return "partly-cloudy";
  if (icon.startsWith("03") || icon.startsWith("04")) return "cloudy";
  if (icon.startsWith("09") || icon.startsWith("10")) return "rain";
  if (icon.startsWith("11")) return "thunderstorm";
  if (icon.startsWith("13")) return "snow";
  if (icon.startsWith("50")) return "mist";
  return "clear";
}

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
