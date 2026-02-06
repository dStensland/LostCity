// Polished playful icons - clean lines with personality

import { SVGProps } from "react";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export function CalendarIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <rect x="3" y="6" width="18" height="15" rx="2.5" stroke="currentColor" strokeWidth="2"/>
      <path d="M3 10h18" stroke="currentColor" strokeWidth="2"/>
      <path d="M8 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="8" cy="14" r="1" fill="currentColor"/>
      <circle cx="12" cy="14" r="1" fill="currentColor"/>
      <circle cx="16" cy="14" r="1" fill="currentColor"/>
      <circle cx="8" cy="17.5" r="1" fill="currentColor"/>
      <circle cx="12" cy="17.5" r="1" fill="currentColor"/>
    </svg>
  );
}

export function LightningIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path
        d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FreeIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 7v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path
        d="M9 9.5c0-1.1.9-2 2-2h1.5c1.4 0 2.5 1.1 2.5 2.5s-1.1 2.5-2.5 2.5H11c-1.4 0-2.5 1.1-2.5 2.5s1.1 2.5 2.5 2.5h2c1.1 0 2-.9 2-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IndoorIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path
        d="M3 10.5L12 4l9 6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect x="9" y="14" width="6" height="6" rx="0.5" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}

export function MuseumIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path d="M3 10L12 4l9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 10v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M9 10v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M15 10v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M19 10v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M3 19h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="7" r="1" fill="currentColor"/>
    </svg>
  );
}

export function OutdoorIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path d="M12 21v-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="8" r="5" stroke="currentColor" strokeWidth="2"/>
      <circle cx="8" cy="7" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="15" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

export function TheaterIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
      <circle cx="9" cy="10" r="1.5" fill="currentColor"/>
      <circle cx="15" cy="10" r="1.5" fill="currentColor"/>
      <path
        d="M8 15c1 1.5 3 2 4 2s3-.5 4-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LibraryIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <rect x="4" y="3" width="4" height="18" rx="1" stroke="currentColor" strokeWidth="2"/>
      <rect x="10" y="5" width="4" height="16" rx="1" stroke="currentColor" strokeWidth="2"/>
      <rect x="16" y="3" width="4" height="18" rx="1" stroke="currentColor" strokeWidth="2"/>
      <path d="M6 7v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M18 7v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export function SportsIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 3v18" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M3 12h18" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 6c3 2 3 10 0 12" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <path d="M19 6c-3 2-3 10 0 12" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    </svg>
  );
}

export function FestivalIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path d="M4 20l8-14 8 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 20l4-7 4 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 6V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M12 3l4 2-4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

export function BirthdayIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <rect x="4" y="11" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="2"/>
      <path d="M4 15h16" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M9 11V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M15 11V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M9 8c-1-2 1-4 0-4s1 2 0 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M15 8c-1-2 1-4 0-4s1 2 0 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export function CampIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path d="M3 20l9-14 9 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 20l3-5 3 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="18" cy="5" r="1.5" fill="currentColor"/>
      <circle cx="6" cy="6" r="1" fill="currentColor"/>
      <circle cx="20" cy="9" r="0.75" fill="currentColor"/>
    </svg>
  );
}

export function RainyDayIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path
        d="M6 14a4 4 0 01-.5-7.97A6 6 0 0117.5 6a4.5 4.5 0 01.5 8.97"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M8 18v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M12 17v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 18v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export function StarIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path
        d="M12 3l2.5 5.5L20 9.5l-4 4 1 5.5-5-2.5-5 2.5 1-5.5-4-4 5.5-1L12 3z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowRightIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Keep these for backwards compatibility but simplified
export function SplatShape({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...props}>
      <ellipse cx="50" cy="50" rx="45" ry="40" fill="currentColor"/>
    </svg>
  );
}

export function SlimeDrip({ color, className }: { color: string; className?: string }) {
  const colorClass = createCssVarClass("--slime-color", color, "slime-color");
  return (
    <div
      className={`h-full bg-[var(--slime-color)] ${className ?? ""} ${
        colorClass?.className ?? ""
      }`}
    >
      <ScopedStyles css={colorClass?.css ?? null} />
    </div>
  );
}

export function SlimeBurst({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...props}>
      <circle cx="50" cy="50" r="40" fill="currentColor"/>
    </svg>
  );
}

export function SquigglyLine({ color, className }: { color: string; className?: string }) {
  const colorClass = createCssVarClass("--squiggle-color", color, "squiggle-color");
  return (
    <div
      className={`h-[2px] bg-[var(--squiggle-color)] ${className ?? ""} ${
        colorClass?.className ?? ""
      }`}
    >
      <ScopedStyles css={colorClass?.css ?? null} />
    </div>
  );
}

export const FamilyIcons = {
  calendar: CalendarIcon,
  lightning: LightningIcon,
  free: FreeIcon,
  indoor: IndoorIcon,
  museum: MuseumIcon,
  outdoor: OutdoorIcon,
  theater: TheaterIcon,
  library: LibraryIcon,
  sports: SportsIcon,
  festival: FestivalIcon,
  birthday: BirthdayIcon,
  camp: CampIcon,
  rainyDay: RainyDayIcon,
  star: StarIcon,
  arrowRight: ArrowRightIcon,
} as const;
