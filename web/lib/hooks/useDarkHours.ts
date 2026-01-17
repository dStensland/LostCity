"use client";

import { useState, useEffect } from "react";

/**
 * Hook that detects "dark hours" (10pm-5am) for enhanced nightlife theming.
 * Returns true during night hours when the darker, more neon-glowy theme should activate.
 */
export function useDarkHours(): boolean {
  const [isDarkHours, setIsDarkHours] = useState(false);

  useEffect(() => {
    const checkDarkHours = () => {
      const hour = new Date().getHours();
      // 10pm (22) to 5am (4) = dark hours
      setIsDarkHours(hour >= 22 || hour < 5);
    };

    // Check immediately
    checkDarkHours();

    // Recheck every minute
    const interval = setInterval(checkDarkHours, 60000);

    return () => clearInterval(interval);
  }, []);

  return isDarkHours;
}
