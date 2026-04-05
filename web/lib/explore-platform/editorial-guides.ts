import type { ExploreEditorialPromo } from "./types";

export interface ExploreEditorialGuideSection {
  title: string;
  description: string;
  href: string;
  cta: string;
}

export interface ExploreEditorialGuide extends ExploreEditorialPromo {
  intro: string;
  note: string;
  sections: ExploreEditorialGuideSection[];
}

const ATLANTA_EDITORIAL_GUIDES: ExploreEditorialGuide[] = [
  {
    id: "the-midnight-train",
    title: "The Midnight Train",
    description: "Atlanta after dark, from late-night institutions to odd-hour rituals.",
    href: "/atlanta/explore/the-midnight-train",
    accentToken: "var(--vibe)",
    intro:
      "Atlanta changes character after 10pm. The point of this guide is not to flatten that into one nightlife list, but to show the different late-night modes the city offers.",
    note:
      "Use this as an editorial jumping-off point, then move into the live lanes when you want what is happening tonight instead of the enduring shape of the scene.",
    sections: [
      {
        title: "Live music after dark",
        description: "Start in Shows when the intent is performance-first and you want the music tab already active.",
        href: "/atlanta/explore?lane=shows&tab=music",
        cta: "Open the shows lane",
      },
      {
        title: "Late-night destinations",
        description: "Jump into Places when you know the move is bars, rooftops, cocktails, or food that carries the night forward.",
        href: "/atlanta/explore?lane=places&search=late%20night",
        cta: "Browse late-night places",
      },
      {
        title: "What is still happening tonight",
        description: "Use Events when you want the live event stack rather than the slower editorial route.",
        href: "/atlanta/explore?lane=events&date=today",
        cta: "See tonight's events",
      },
    ],
  },
  {
    id: "city-in-a-forest",
    title: "City in a Forest",
    description: "Trails, parks, and nature-forward escapes woven into the city.",
    href: "/atlanta/explore/city-in-a-forest",
    accentToken: "var(--neon-green)",
    intro:
      "Atlanta's outdoor identity is not a single park or one marquee trail. It is a network of green escapes, neighborhood loops, and destinations that make the city feel more porous than its traffic suggests.",
    note:
      "This guide frames the landscape. When you want something concrete right now, pivot into Places or Events from here.",
    sections: [
      {
        title: "Outdoor places worth going to",
        description: "Places is the best destination-first lane when the intent is parks, gardens, trailheads, and green escapes.",
        href: "/atlanta/explore?lane=places&search=park",
        cta: "Browse parks and places",
      },
      {
        title: "Nature-forward classes and programs",
        description: "Classes is the right move when the outing is structured: walks, camps, workshops, or lessons.",
        href: "/atlanta/explore?lane=classes&q=outdoors",
        cta: "Browse classes and programs",
      },
      {
        title: "What is happening outside this week",
        description: "Events remains the live layer for markets, runs, festivals, and outdoor gatherings.",
        href: "/atlanta/explore?lane=events&search=outdoor",
        cta: "See outdoor events",
      },
    ],
  },
  {
    id: "the-itis",
    title: "The Itis",
    description: "A slower, tastier editorial route through Atlanta eating and gathering.",
    href: "/atlanta/explore/the-itis",
    accentToken: "var(--gold)",
    intro:
      "Food discovery should not be reduced to whatever is trending this weekend. The city has enduring brunch spots, neighborhood institutions, and rooms built for lingering longer than your original plan.",
    note:
      "Stay here for the editorial framing, then move into Places when you want a destination-level answer or Events when the meal is tied to something happening live.",
    sections: [
      {
        title: "Brunch and slow meals",
        description: "Places already handles intent-rich food discovery well and is the fastest path when you know the vibe you want.",
        href: "/atlanta/explore?lane=places&search=brunch",
        cta: "Browse brunch places",
      },
      {
        title: "Cocktails and date-night rooms",
        description: "Use the Places lane again when the move is not one meal but a whole night built around a room.",
        href: "/atlanta/explore?lane=places&search=cocktails",
        cta: "Browse cocktail spots",
      },
      {
        title: "Food-adjacent happenings",
        description: "Switch to Events when the draw is a tasting, market, pop-up, or one-night gathering.",
        href: "/atlanta/explore?lane=events&search=food",
        cta: "See food events",
      },
    ],
  },
];

export function getExploreEditorialPromos(
  portalSlug: string,
): ExploreEditorialPromo[] {
  if (portalSlug !== "atlanta") {
    return [];
  }

  return ATLANTA_EDITORIAL_GUIDES.map(
    ({ id, title, description, href, accentToken }) => ({
      id,
      title,
      description,
      href,
      accentToken,
    }),
  );
}

export function getExploreEditorialGuide(
  portalSlug: string,
  slug: string,
): ExploreEditorialGuide | null {
  if (portalSlug !== "atlanta") {
    return null;
  }

  return ATLANTA_EDITORIAL_GUIDES.find((guide) => guide.id === slug) ?? null;
}
