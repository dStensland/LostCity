"use client";

// Hand-drawn punk zine style SVG icons for Places to Go category tiles.
// Paths are intentionally imperfect — wobbly control points, rough strokes —
// to evoke a quick Sharpie sketch rather than clean geometric vectors.
// All icons: viewBox 0 0 24 24, stroke-based (no fill), stroke-width 2–2.5,
// stroke-linecap="round", stroke-linejoin="round".

interface ZineIconProps {
  className?: string;
  style?: React.CSSProperties;
}

export function ParksIcon({ className, style }: ZineIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden>
      {/* Wobbly trunk */}
      <path
        d="M11.8 21.2 C11.9 17.8 12.2 15.3 11.7 12.9"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Scribbly cloud-shape canopy */}
      <path
        d="M5.3 13.1 C4.8 10.8 6.1 8.4 8.2 7.4 C8.7 5.1 10.8 3.4 12.8 3.6 C14.9 3.8 16.6 5.5 16.8 7.5 C18.8 8.1 20.1 10.2 19.4 12.3 C18.8 14.2 16.9 15.1 15.1 14.8 C14.3 16.1 12.8 16.8 11.3 16.4 C9.7 16.7 7.9 15.9 6.9 14.5 C5.8 14.3 4.9 13.7 5.3 13.1 Z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

export function TrailsIcon({ className, style }: ZineIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden>
      {/* Rough mountain peaks */}
      <path
        d="M2.3 18.8 L7.8 8.3 L12.1 14.2 L15.9 7.1 L21.7 18.9"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Wavy trail line */}
      <path
        d="M3.1 21.3 C5.8 20.1 7.2 21.8 9.9 20.6 C12.4 19.5 14.1 21.4 16.8 20.3 C18.5 19.6 19.9 20.1 21.2 21.1"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

export function MuseumsIcon({ className, style }: ZineIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden>
      {/* Triangle roof — slightly lopsided */}
      <path
        d="M2.8 8.1 L12.2 2.7 L21.4 8.3"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Top horizontal beam */}
      <path
        d="M2.1 9.4 L21.9 9.2"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      />
      {/* Columns — 3 slightly uneven */}
      <path d="M5.3 9.6 L5.2 19.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12.1 9.7 L12.3 19.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18.8 9.5 L18.7 19.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Base */}
      <path
        d="M2.3 20.1 L21.8 20.3"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
      />
    </svg>
  );
}

export function GalleriesIcon({ className, style }: ZineIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden>
      {/* Rough easel — two legs, crossbar */}
      <path
        d="M12.1 3.2 L6.4 19.8"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      />
      <path
        d="M12.3 3.1 L17.8 19.7"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      />
      <path
        d="M8.3 12.4 L15.9 12.1"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      />
      {/* Canvas rectangle on easel — slightly tilted */}
      <rect
        x="7.8" y="3.4" width="8.3" height="6.2" rx="0.4"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        transform="rotate(-1.5 12 6.5)"
      />
      {/* Paint splatter dots */}
      <circle cx="18.3" cy="7.1" r="1" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="20.1" cy="10.4" r="0.7" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="16.9" cy="5.2" r="0.6" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function TheatersIcon({ className, style }: ZineIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden>
      {/* Comedy/drama mask — single, slightly tilted */}
      {/* Smiling mask — outer shape */}
      <path
        d="M5.1 8.3 C5.3 4.9 8.4 2.6 11.9 2.8 C15.4 3.0 18.2 5.7 18.1 9.1 C18.0 12.2 16.4 14.8 14.1 16.4 C13.1 17.1 12.0 17.4 10.9 17.1 C9.8 16.8 8.8 16.0 8.0 14.9 C6.2 12.9 4.9 10.9 5.1 8.3 Z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        transform="rotate(-6 12 10)"
      />
      {/* Eyes */}
      <path d="M8.9 8.6 C9.1 7.9 9.7 7.6 10.2 7.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" transform="rotate(-6 12 10)" />
      <path d="M13.2 8.4 C13.5 7.8 14.1 7.6 14.5 8.0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" transform="rotate(-6 12 10)" />
      {/* Smile */}
      <path
        d="M9.2 12.2 C10.1 13.6 13.2 13.8 14.3 12.4"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        transform="rotate(-6 12 10)"
      />
      {/* Theater hat/string at bottom */}
      <path
        d="M11.8 17.3 L11.4 20.8"
        stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
      />
      <path
        d="M9.3 21.2 L13.8 21.0"
        stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"
      />
    </svg>
  );
}

export function MusicIcon({ className, style }: ZineIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden>
      {/* Wobbly stem */}
      <path
        d="M13.2 18.9 C13.4 15.2 13.1 11.4 12.8 7.3"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
      />
      {/* Note flag — slightly curved, rough */}
      <path
        d="M12.9 7.2 C15.4 6.4 18.3 6.9 19.8 8.8 C18.7 10.4 16.1 11.3 13.4 10.6"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Filled circle at base — open circle sketch */}
      <ellipse
        cx="10.9" cy="19.6" rx="2.6" ry="1.9"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        transform="rotate(-12 10.9 19.6)"
      />
    </svg>
  );
}

export function RestaurantsIcon({ className, style }: ZineIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden>
      {/* Fork — three tines, wobbly */}
      <path
        d="M6.8 3.2 L6.6 21.1"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      />
      <path d="M4.9 3.3 L4.8 9.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.8 3.2 L6.7 9.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.8 3.4 L8.7 9.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M4.8 9.9 C5.1 11.6 6.2 12.4 6.8 12.3 C7.4 12.4 8.5 11.5 8.7 9.8"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Knife — blade + handle, slightly off-center */}
      <path
        d="M16.2 3.1 L16.4 21.2"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      />
      <path
        d="M16.2 3.2 C18.3 4.1 19.4 6.2 19.1 8.9 C18.8 10.8 17.8 12.1 16.3 12.4"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

export function NightlifeIcon({ className, style }: ZineIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden>
      {/* Cocktail glass — tilted slightly */}
      <path
        d="M5.9 3.2 L18.3 3.4 L12.8 12.1 L12.6 18.8"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        transform="rotate(4 12 11)"
      />
      <path
        d="M9.6 19.1 L15.9 19.3"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
        transform="rotate(4 12 11)"
      />
      {/* Olive on toothpick */}
      <path
        d="M14.9 8.6 L18.7 6.2"
        stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
      />
      <circle cx="19.2" cy="5.8" r="1.4" stroke="currentColor" strokeWidth="1.7" />
      {/* Liquid line inside glass */}
      <path
        d="M9.2 9.1 L14.8 9.3"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
        transform="rotate(4 12 11)"
      />
    </svg>
  );
}

export function MarketsIcon({ className, style }: ZineIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden>
      {/* Shopping bag — slightly lumpy */}
      <path
        d="M5.2 8.8 L4.1 20.3 C4.0 21.1 4.7 21.8 5.5 21.7 L18.4 21.9 C19.2 21.9 19.9 21.2 19.8 20.4 L18.9 8.7 Z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Handles */}
      <path
        d="M9.1 8.7 C8.9 6.2 10.1 4.1 12.0 3.8 C14.1 3.5 15.6 5.2 15.3 8.6"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Star/asterisk on bag */}
      <path d="M12.1 13.2 L12.2 17.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10.2 14.2 L14.1 16.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14.2 14.1 L10.1 16.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function LibrariesIcon({ className, style }: ZineIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden>
      {/* Open book — slightly angled pages */}
      <path
        d="M3.1 18.4 C3.2 8.9 3.4 6.3 3.6 5.8 C3.9 5.1 5.2 4.7 6.9 5.1 C8.8 5.6 10.9 7.1 12.0 8.8"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M20.9 18.3 C20.8 8.8 20.6 6.2 20.4 5.7 C20.1 5.0 18.8 4.6 17.1 5.0 C15.2 5.5 13.1 7.0 12.0 8.8"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M3.2 18.6 L12.1 18.8 L20.8 18.5"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      />
      <path
        d="M12.0 8.9 L12.1 18.7"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      />
      {/* Scribble lines = text on left page */}
      <path d="M5.8 9.3 L10.1 9.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5.9 11.8 L10.2 11.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5.8 14.2 L9.3 14.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Scribble lines = text on right page */}
      <path d="M13.8 9.3 L18.1 9.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13.9 11.7 L18.2 11.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13.8 14.1 L17.3 14.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function GamesIcon({ className, style }: ZineIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden>
      {/* Rough dice — slightly rotated cube perspective */}
      <path
        d="M4.2 7.3 L12.1 3.8 L19.9 7.2 L20.1 16.7 L12.2 20.4 L4.1 16.8 Z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Top face divider */}
      <path
        d="M4.2 7.4 L12.2 10.8 L20.0 7.3"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      />
      {/* Vertical spine */}
      <path
        d="M12.2 10.9 L12.1 20.3"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      />
      {/* Dots on top face */}
      <circle cx="9.8" cy="7.4" r="0.9" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14.4" cy="7.3" r="0.9" stroke="currentColor" strokeWidth="1.5" />
      {/* Dots on right face */}
      <circle cx="16.8" cy="12.1" r="0.9" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17.4" cy="15.8" r="0.9" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14.9" cy="13.8" r="0.9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function HistoricIcon({ className, style }: ZineIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden>
      {/* Compass rose — hand-drawn, slightly wonky */}
      {/* Circle */}
      <circle
        cx="12.1" cy="11.9" r="8.3"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      />
      {/* North-South arrow — slightly curved */}
      <path
        d="M12.2 4.1 C11.9 6.8 12.3 9.2 12.0 11.8 C11.8 14.3 12.2 16.8 11.9 19.7"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      />
      {/* East-West arrow */}
      <path
        d="M3.8 11.7 C6.4 12.1 9.1 11.8 12.1 12.0 C14.9 12.2 17.6 11.9 20.3 12.2"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      />
      {/* N arrowhead */}
      <path
        d="M10.8 5.9 L12.1 3.9 L13.4 5.8"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* S arrowhead */}
      <path
        d="M10.7 17.9 L12.0 19.8 L13.2 17.8"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Center dot */}
      <circle cx="12.1" cy="11.9" r="1.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

// Map from category key to zine icon component
const ZINE_ICON_MAP: Record<string, React.FC<ZineIconProps>> = {
  parks_gardens: ParksIcon,
  trails_nature: TrailsIcon,
  museums: MuseumsIcon,
  galleries_studios: GalleriesIcon,
  theaters_stage: TheatersIcon,
  music_venues: MusicIcon,
  restaurants: RestaurantsIcon,
  bars_nightlife: NightlifeIcon,
  markets_local: MarketsIcon,
  libraries_learning: LibrariesIcon,
  fun_games: GamesIcon,
  historic_sites: HistoricIcon,
};

export function getZineIcon(categoryKey: string): React.FC<ZineIconProps> {
  return ZINE_ICON_MAP[categoryKey] ?? HistoricIcon;
}
