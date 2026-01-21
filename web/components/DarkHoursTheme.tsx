"use client";

import { useDarkHours } from "@/lib/hooks/useDarkHours";

/**
 * Injects darker CSS variables during "dark hours" (10pm-5am).
 * Makes the theme more immersive for nightlife browsing with:
 * - Deeper blacks for backgrounds
 * - Intensified neon glow effects
 * - Subtle ambient animation
 * - Enhanced button and link glows
 * Respects prefers-reduced-motion.
 */
export default function DarkHoursTheme() {
  const { isDarkHours, hour } = useDarkHours();

  if (!isDarkHours) {
    return null;
  }

  // Calculate depth based on time: deepest at 2-3am, lighter at 10pm and 5am
  const getDepthMultiplier = () => {
    if (hour >= 1 && hour <= 3) return 1.0; // Peak darkness
    if (hour === 0 || hour === 4) return 0.8;
    if (hour === 23 || hour === 5) return 0.6;
    return 0.4; // 10pm
  };
  const depth = getDepthMultiplier();

  const darkHoursStyles = `
    :root {
      /* Deeper blacks - intensity varies with time */
      --void: hsl(240, 15%, ${2 + (1 - depth) * 2}%);
      --night: hsl(240, 12%, ${4 + (1 - depth) * 3}%);
      --dusk: hsl(240, 10%, ${7 + (1 - depth) * 4}%);

      /* Intensified neons (+5% brightness, +10% saturation) */
      --neon-magenta: hsl(330, 95%, 58%);
      --neon-cyan: hsl(185, 100%, 50%);
      --neon-amber: hsl(40, 100%, 58%);
      --neon-green: hsl(145, 95%, 55%);
      --coral: #E8912D;
      --rose: #E8912D;
    }

    /* Enhanced glow effects during dark hours */
    .card-interactive:hover {
      box-shadow: 0 0 30px rgba(232, 145, 45, 0.25), 0 0 60px rgba(232, 145, 45, 0.12);
    }

    .badge-featured,
    .badge-trending {
      box-shadow: 0 0 12px rgba(232, 145, 45, 0.5);
    }

    /* Enhanced button glows */
    .glow-sm {
      box-shadow: 0 0 15px rgba(232, 145, 45, 0.4), 0 0 30px rgba(232, 145, 45, 0.2);
    }

    /* Link hover glow */
    a:hover {
      text-shadow: 0 0 8px currentColor;
    }

    /* Category icon glow enhancement */
    .icon-neon,
    .icon-neon-subtle {
      filter: drop-shadow(0 0 4px currentColor);
    }

    /* Ambient glow pulse - respects reduced motion */
    @media (prefers-reduced-motion: no-preference) {
      .ambient-glow {
        animation: dark-hours-pulse 8s ease-in-out infinite;
      }

      @keyframes dark-hours-pulse {
        0%, 100% {
          opacity: ${0.3 + depth * 0.2};
        }
        50% {
          opacity: ${0.5 + depth * 0.2};
        }
      }

      /* Subtle floating particles effect */
      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 9998;
        background-image:
          radial-gradient(1px 1px at 10% 20%, rgba(232, 145, 45, 0.3), transparent),
          radial-gradient(1px 1px at 30% 70%, rgba(232, 145, 45, 0.2), transparent),
          radial-gradient(1px 1px at 60% 40%, rgba(232, 145, 45, 0.25), transparent),
          radial-gradient(1px 1px at 80% 80%, rgba(232, 145, 45, 0.15), transparent),
          radial-gradient(1px 1px at 90% 10%, rgba(232, 145, 45, 0.2), transparent);
        animation: float-particles 20s linear infinite;
        opacity: ${depth * 0.5};
      }

      @keyframes float-particles {
        0%, 100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-10px);
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
          rgba(0, 0, 0, ${0.02 + depth * 0.02}) 2px,
          rgba(0, 0, 0, ${0.02 + depth * 0.02}) 4px
        );
      }
    }

    /* Live event cards get extra glow at night */
    .card-live-heat {
      box-shadow: 0 0 20px rgba(239, 68, 68, 0.3), 0 0 40px rgba(239, 68, 68, 0.15);
    }

    /* Enhanced navigation progress bar */
    [role="progressbar"] > div {
      box-shadow: 0 0 15px var(--neon-magenta), 0 0 30px var(--coral);
    }
  `;

  return <style dangerouslySetInnerHTML={{ __html: darkHoursStyles }} />;
}
