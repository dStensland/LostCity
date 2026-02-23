/**
 * Conversion prompt generation for anonymous users.
 *
 * These "taste moments" are inserted between City Pulse sections to
 * encourage sign-up. Each renders once per session. After sign-up,
 * the friends/save teasers disappear. After setting prefs, the prefs
 * teaser disappears. Progressive reveal of feed improvements.
 */

import type {
  CityPulseConversionItem,
  PersonalizationLevel,
} from "./types";

// ---------------------------------------------------------------------------
// Prompt definitions
// ---------------------------------------------------------------------------

interface ConversionPromptDef {
  prompt_type: CityPulseConversionItem["conversion"]["prompt_type"];
  /** Which section type this prompt should appear after */
  after_section: string;
  headline: string;
  cta_label: string;
  cta_href_template: string; // {{portalSlug}} placeholder
  /** Show only at these personalization levels */
  show_at: PersonalizationLevel[];
}

const PROMPTS: ConversionPromptDef[] = [
  {
    prompt_type: "friends_teaser",
    after_section: "right_now",
    headline: "See who's going out tonight",
    cta_label: "Sign up",
    cta_href_template: "/auth/signup?redirect=/{{portalSlug}}",
    show_at: ["anonymous"],
  },
  {
    prompt_type: "save_teaser",
    after_section: "trending",
    headline: "Save events you love — never miss out",
    cta_label: "Sign up",
    cta_href_template: "/auth/signup?redirect=/{{portalSlug}}",
    show_at: ["anonymous"],
  },
  {
    prompt_type: "prefs_teaser",
    after_section: "trending",
    headline: "Tell us what you like for better picks",
    cta_label: "Set preferences",
    cta_href_template: "/{{portalSlug}}?view=feed&tab=foryou",
    show_at: ["logged_in"],
  },
  {
    prompt_type: "calendar_teaser",
    after_section: "coming_up",
    headline: "See events when you're free",
    cta_label: "Connect calendar",
    cta_href_template: "/{{portalSlug}}/settings/calendar",
    show_at: ["logged_in", "has_prefs"],
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the conversion prompt that should appear after a given section type.
 * Returns null if no prompt is appropriate for the current personalization level.
 */
export function getConversionPrompt(
  afterSectionType: string,
  level: PersonalizationLevel,
  portalSlug: string,
): CityPulseConversionItem | null {
  const prompt = PROMPTS.find(
    (p) =>
      p.after_section === afterSectionType && p.show_at.includes(level),
  );

  if (!prompt) return null;

  return {
    item_type: "conversion_prompt",
    conversion: {
      prompt_type: prompt.prompt_type,
      headline: prompt.headline,
      cta_label: prompt.cta_label,
      cta_href: prompt.cta_href_template.replace(
        "{{portalSlug}}",
        portalSlug,
      ),
    },
  };
}

/**
 * Get all applicable conversion prompts for the current personalization level.
 * Used by the section builder to insert prompts between sections.
 */
export function getAllConversionPrompts(
  level: PersonalizationLevel,
  portalSlug: string,
): Map<string, CityPulseConversionItem> {
  const result = new Map<string, CityPulseConversionItem>();

  for (const prompt of PROMPTS) {
    if (!prompt.show_at.includes(level)) continue;
    // Only one prompt per section position
    if (result.has(prompt.after_section)) continue;

    result.set(prompt.after_section, {
      item_type: "conversion_prompt",
      conversion: {
        prompt_type: prompt.prompt_type,
        headline: prompt.headline,
        cta_label: prompt.cta_label,
        cta_href: prompt.cta_href_template.replace(
          "{{portalSlug}}",
          portalSlug,
        ),
      },
    });
  }

  return result;
}
