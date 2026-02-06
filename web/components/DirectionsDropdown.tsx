"use client";

import { useState, useRef, useEffect } from "react";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

interface Props {
  venueName: string;
  address: string;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export default function DirectionsDropdown({
  venueName,
  address,
  city,
  state,
  latitude,
  longitude,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Build the full address for URL encoding
  const fullAddress = [address, city, state].filter(Boolean).join(", ");
  const encodedAddress = encodeURIComponent(fullAddress);
  const encodedName = encodeURIComponent(venueName);

  // Use coordinates if available, otherwise address
  const hasCoords = latitude != null && longitude != null;

  const navOptions = [
    {
      name: "Google Maps",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
        </svg>
      ),
      getUrl: () =>
        hasCoords
          ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${encodedName}`
          : `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`,
      color: "#4285F4",
    },
    {
      name: "Apple Maps",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
        </svg>
      ),
      getUrl: () =>
        hasCoords
          ? `https://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=d`
          : `https://maps.apple.com/?daddr=${encodedAddress}&dirflg=d`,
      color: "#000000",
    },
    {
      name: "Waze",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.54 6.63c.87 1.46 1.32 3.09 1.43 4.75.12 1.7-.15 3.42-.77 5.02a8.4 8.4 0 01-.54 1.14c-.09.15-.18.3-.28.45a3.1 3.1 0 01-2.1 1.37c-.62.1-1.24.01-1.85-.11a8.59 8.59 0 01-1.7-.56c-.4-.17-.8-.35-1.21-.5-.41-.14-.84-.24-1.27-.26-.44-.02-.88.03-1.31.14-.43.1-.86.25-1.27.45-.41.2-.81.43-1.2.68-.39.25-.77.52-1.16.77-.38.25-.78.48-1.2.65-.42.17-.86.28-1.31.31a3.03 3.03 0 01-2.42-.97c-.22-.24-.4-.51-.54-.8a4.89 4.89 0 01-.38-1.02c-.19-.75-.26-1.52-.23-2.29.04-.77.17-1.54.4-2.28.22-.75.54-1.46.93-2.13.4-.67.87-1.3 1.4-1.87.53-.57 1.11-1.09 1.74-1.55.63-.45 1.3-.85 2-1.17a10.9 10.9 0 014.83-1.07c1.63.04 3.22.47 4.65 1.26 1.42.78 2.67 1.88 3.62 3.19zM9.5 10c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm5 0c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z" />
        </svg>
      ),
      getUrl: () =>
        hasCoords
          ? `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`
          : `https://waze.com/ul?q=${encodedAddress}&navigate=yes`,
      color: "#33CCFF",
    },
    {
      name: "Uber",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
        </svg>
      ),
      getUrl: () => {
        const dropoffParam = hasCoords
          ? `dropoff[latitude]=${latitude}&dropoff[longitude]=${longitude}`
          : `dropoff[formatted_address]=${encodedAddress}`;
        return `https://m.uber.com/ul/?action=setPickup&pickup=my_location&${dropoffParam}&dropoff[nickname]=${encodedName}`;
      },
      color: "#000000",
    },
    {
      name: "Lyft",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </svg>
      ),
      getUrl: () => {
        if (hasCoords) {
          return `https://lyft.com/ride?id=lyft&destination[latitude]=${latitude}&destination[longitude]=${longitude}`;
        }
        return `https://lyft.com/ride?id=lyft&destination[address]=${encodedAddress}`;
      },
      color: "#FF00BF",
    },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--coral)] hover:text-[var(--rose)] font-medium transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
        Get Directions
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-48 max-w-[calc(100vw-2rem)] bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg shadow-xl z-[1050] overflow-hidden">
          {navOptions.map((option) => {
            const optionClass = createCssVarClass("--option-color", option.color, "option-color");
            return (
              <a
                key={option.name}
                href={option.getUrl()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--twilight)] transition-colors text-[var(--soft)] hover:text-[var(--cream)] ${optionClass?.className ?? ""}`}
              >
                <ScopedStyles css={optionClass?.css} />
                <span className="text-option">{option.icon}</span>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
