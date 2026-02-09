export const MAPBOX_TOKEN =
  "pk.eyJ1IjoiZHN0ZW5zbGFuZCIsImEiOiJjbWxlaHo4aXYxbWdoM2VvZmNxYzI3amVzIn0.xnPbU9ijBcU_jTfpu8jNAw";

export const DARK_STYLE = "mapbox://styles/mapbox/dark-v11";
export const LIGHT_STYLE = "mapbox://styles/mapbox/light-v11";

export function getMapStyle(isLightTheme: boolean = false): string {
  return isLightTheme ? LIGHT_STYLE : DARK_STYLE;
}

// Atlanta default center (Ponce City Market area)
export const ATLANTA_CENTER = { latitude: 33.7725, longitude: -84.3655 };
export const DEFAULT_ZOOM = 12;
