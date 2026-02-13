export type GuestJourneyPersona = "first_time" | "business_traveler" | "weekend_couple" | "wellness_guest" | "club_member";
export type GuestDiscoveryMode = "tonight" | "future";
export type GuestMood = "any" | "live_music" | "comedy" | "sports" | "arts";
export type GuestCraving = "any" | "cocktails" | "sports_bar" | "mexican" | "coffee" | "rooftop";
export type GuestDaypart = "all" | "morning" | "day" | "evening" | "late_night";

export interface GuestJourneyState {
  persona: GuestJourneyPersona;
  discoveryMode: GuestDiscoveryMode;
  mood: GuestMood;
  craving: GuestCraving;
  daypart: GuestDaypart;
  futureDate: string | null;
}

export const DEFAULT_GUEST_JOURNEY_STATE: GuestJourneyState = {
  persona: "first_time",
  discoveryMode: "tonight",
  mood: "any",
  craving: "any",
  daypart: "all",
  futureDate: null,
};
