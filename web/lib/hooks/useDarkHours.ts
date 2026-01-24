"use client";

import { useState, useEffect, useCallback } from "react";

const DARK_HOURS_OVERRIDE_KEY = "dark_hours_override";

/**
 * Hook that detects "dark hours" (10pm-5am) for enhanced nightlife theming.
 * Returns true during night hours when the darker, more neon-glowy theme should activate.
 * Supports manual override via localStorage for testing.
 * Also returns the current hour for time-based intensity adjustments.
 */
export function useDarkHours(): {
  isDarkHours: boolean;
  isOverride: boolean;
  hour: number;
  toggleOverride: () => void;
} {
  const [isDarkHours, setIsDarkHours] = useState(false);
  const [isOverride, setIsOverride] = useState(false);
  const [hour, setHour] = useState(() => new Date().getHours());

  useEffect(() => {
    // Check for manual override in localStorage
    const override = localStorage.getItem(DARK_HOURS_OVERRIDE_KEY);
    if (override === "on") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync with localStorage override
      setIsDarkHours(true);
      setIsOverride(true);
      return;
    } else if (override === "off") {
       
      setIsDarkHours(false);
      setIsOverride(true);
      return;
    }

    const checkDarkHours = () => {
      const currentHour = new Date().getHours();
      setHour(currentHour);
      // 10pm (22) to 5am (4) = dark hours
      setIsDarkHours(currentHour >= 22 || currentHour < 5);
    };

    // Check immediately
    checkDarkHours();

    // Recheck every minute
    const interval = setInterval(checkDarkHours, 60000);

    return () => clearInterval(interval);
  }, []);

  const toggleOverride = useCallback(() => {
    const currentOverride = localStorage.getItem(DARK_HOURS_OVERRIDE_KEY);

    if (currentOverride === "on") {
      // Currently forced on -> turn off override (back to auto)
      localStorage.removeItem(DARK_HOURS_OVERRIDE_KEY);
      setIsOverride(false);
      // Check actual time
      const currentHour = new Date().getHours();
      setHour(currentHour);
      setIsDarkHours(currentHour >= 22 || currentHour < 5);
    } else {
      // Not forced on -> force on
      localStorage.setItem(DARK_HOURS_OVERRIDE_KEY, "on");
      setIsOverride(true);
      setIsDarkHours(true);
    }
  }, []);

  return { isDarkHours, isOverride, hour, toggleOverride };
}
