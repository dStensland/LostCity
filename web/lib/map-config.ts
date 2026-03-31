export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export const DARK_STYLE = "mapbox://styles/mapbox/dark-v11";
export const LIGHT_STYLE = "mapbox://styles/mapbox/light-v11";

export function getMapStyle(isLightTheme: boolean = false): string {
  return isLightTheme ? LIGHT_STYLE : DARK_STYLE;
}

// Atlanta default center (Ponce City Market area)
export const ATLANTA_CENTER = { latitude: 33.7725, longitude: -84.3655 };
export const DEFAULT_ZOOM = 12;

// MapLibre / CARTO styles (no API key required)
export const MAPLIBRE_DARK_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
