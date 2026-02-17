import {
  MoonStars,
  HeartHalf,
  SunHorizon,
  Waveform,
  CookingPot,
  BeerStein,
  AirplaneTilt,
  Coffee as CoffeeBean,
  Palette,
  PiggyBank,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react/dist/lib/types";

/** Map best-of category slugs to Phosphor icons */
export const BEST_OF_ICONS: Record<string, Icon> = {
  "where-you-end-up-at-1am": MoonStars,
  "medium-effort-first-date": HeartHalf,
  "cool-patio": SunHorizon,
  "place-to-hear-a-band": Waveform,
  "underrated-kitchen": CookingPot,
  "the-cheers-bar": BeerStein,
  "out-of-towner-converter": AirplaneTilt,
  "third-place": CoffeeBean,
  "where-you-find-local-art": Palette,
  "in-this-economy": PiggyBank,
};

export const DEFAULT_BEST_OF_ICON = CoffeeBean;
