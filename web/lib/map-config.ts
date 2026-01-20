export const DARK_MAP_TILES = {
  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
};

export const LIGHT_MAP_TILES = {
  url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
};

export const getMapTiles = (isLightTheme: boolean = false) => {
  return isLightTheme ? LIGHT_MAP_TILES : DARK_MAP_TILES;
};
