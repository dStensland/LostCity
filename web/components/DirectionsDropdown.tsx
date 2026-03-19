"use client";

import { useState, useRef, useEffect } from "react";
import { NavigationArrow } from "@phosphor-icons/react";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

interface Props {
  venueName: string;
  address: string;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Column layout: icon above label, for sidebar grid */
  compact?: boolean;
}

export default function DirectionsDropdown({
  venueName,
  address,
  city,
  state,
  latitude,
  longitude,
  compact = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fullAddress = [address, city, state].filter(Boolean).join(", ");
  const encodedAddress = encodeURIComponent(fullAddress);
  const encodedName = encodeURIComponent(venueName);
  const hasCoords = latitude != null && longitude != null;

  const navOptions = [
    {
      name: "Google Maps",
      getUrl: () =>
        hasCoords
          ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${encodedName}`
          : `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`,
    },
    {
      name: "Apple Maps",
      getUrl: () =>
        hasCoords
          ? `https://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=d`
          : `https://maps.apple.com/?daddr=${encodedAddress}&dirflg=d`,
    },
    {
      name: "Waze",
      getUrl: () =>
        hasCoords
          ? `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`
          : `https://waze.com/ul?q=${encodedAddress}&navigate=yes`,
    },
    {
      name: "Uber",
      getUrl: () => {
        const dropoffParam = hasCoords
          ? `dropoff[latitude]=${latitude}&dropoff[longitude]=${longitude}`
          : `dropoff[formatted_address]=${encodedAddress}`;
        return `https://m.uber.com/ul/?action=setPickup&pickup=my_location&${dropoffParam}&dropoff[nickname]=${encodedName}`;
      },
    },
    {
      name: "Lyft",
      getUrl: () => {
        if (hasCoords) {
          return `https://lyft.com/ride?id=lyft&destination[latitude]=${latitude}&destination[longitude]=${longitude}`;
        }
        return `https://lyft.com/ride?id=lyft&destination[address]=${encodedAddress}`;
      },
    },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={
          compact
            ? "flex flex-col items-center justify-center gap-1 py-2 min-h-[44px] w-full text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/30 rounded-lg text-xs font-mono transition-colors focus-ring"
            : "inline-flex items-center gap-2 px-3 py-1.5 min-h-[44px] text-sm text-[var(--coral)] hover:text-[var(--rose)] font-medium transition-colors focus-ring"
        }
      >
        <NavigationArrow size={18} weight="light" aria-hidden="true" />
        Directions
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-48 max-w-[calc(100vw-2rem)] bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg shadow-xl z-[1050] overflow-hidden">
          {navOptions.map((option) => (
            <a
              key={option.name}
              href={option.getUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--twilight)] transition-colors text-[var(--soft)] hover:text-[var(--cream)]"
            >
              <span className="text-sm">{option.name}</span>
              <svg
                className="w-3 h-3 ml-auto text-[var(--muted)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
