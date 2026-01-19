"use client";

import { useDarkHours } from "@/lib/hooks/useDarkHours";

/**
 * Injects darker CSS variables during "dark hours" (10pm-5am).
 * Makes the theme more immersive for nightlife browsing with:
 * - Deeper blacks for backgrounds
 * - Intensified neon glow effects
 * - Subtle ambient animation
 * Respects prefers-reduced-motion.
 */
export default function DarkHoursTheme() {
  const { isDarkHours } = useDarkHours();

  if (!isDarkHours) {
    return null;
  }

  const darkHoursStyles = `
    :root {
      /* Deeper blacks */
      --void: #050507;
      --night: #0A0A0F;
      --dusk: #12121A;

      /* Intensified neons (+5% brightness, +10% saturation) */
      --neon-magenta: hsl(330, 95%, 58%);
      --neon-cyan: hsl(180, 95%, 58%);
      --neon-amber: hsl(40, 100%, 58%);
      --neon-green: hsl(145, 95%, 55%);
      --coral: hsl(12, 95%, 65%);
      --rose: hsl(340, 95%, 68%);
    }

    /* Enhanced glow effects during dark hours */
    .card-interactive:hover {
      box-shadow: 0 0 30px rgba(232, 85, 160, 0.2), 0 0 60px rgba(232, 85, 160, 0.1);
    }

    .badge-featured {
      box-shadow: 0 0 12px rgba(232, 85, 160, 0.5);
    }

    .badge-trending {
      box-shadow: 0 0 12px rgba(255, 107, 53, 0.5);
    }

    /* Ambient glow pulse - respects reduced motion */
    @media (prefers-reduced-motion: no-preference) {
      .ambient-glow {
        animation: dark-hours-pulse 8s ease-in-out infinite;
      }

      @keyframes dark-hours-pulse {
        0%, 100% {
          opacity: 0.4;
        }
        50% {
          opacity: 0.6;
        }
      }
    }

    /* Subtle scanline effect for that late-night neon vibe */
    @media (prefers-reduced-motion: no-preference) {
      body::after {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 9999;
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0, 0, 0, 0.03) 2px,
          rgba(0, 0, 0, 0.03) 4px
        );
      }
    }
  `;

  return <style dangerouslySetInnerHTML={{ __html: darkHoursStyles }} />;
}
