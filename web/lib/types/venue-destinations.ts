// Venue destination details — maps to venue_destination_details table
// 1:1 extension table for reusable destination intelligence.

export type CommitmentTier = "hour" | "halfday" | "fullday" | "weekend";

export type DifficultyLevel = "easy" | "moderate" | "hard" | "expert";

export type ParkingType = "free_lot" | "paid_lot" | "street" | "garage" | "none";

export type BestTimeOfDay = "morning" | "afternoon" | "evening" | "any";

export type FamilySuitability = "yes" | "no" | "caution";

export interface VenueDestinationDetails {
  venue_id: number;
  destination_type: string | null;
  commitment_tier: CommitmentTier | null;
  primary_activity: string | null;
  drive_time_minutes: number | null;
  difficulty_level: DifficultyLevel | null;
  trail_length_miles: number | null;
  elevation_gain_ft: number | null;
  surface_type: string | null;
  best_seasons: string[] | null;
  weather_fit_tags: string[] | null;
  practical_notes: string | null;
  conditions_notes: string | null;
  accessibility_notes: string | null;
  parking_type: ParkingType | null;
  parking_capacity: number | null;
  best_time_of_day: BestTimeOfDay | null;
  family_suitability: FamilySuitability | null;
  dog_friendly: boolean | null;
  reservation_required: boolean | null;
  permit_required: boolean | null;
  fee_note: string | null;
  seasonal_hazards: string[] | null;
  source_url: string | null;
  metadata: Record<string, unknown>;
  updated_at: string;
}

// Display helpers

export const COMMITMENT_LABELS: Record<CommitmentTier, string> = {
  hour: "Quick Visit",
  halfday: "Half Day",
  fullday: "Full Day",
  weekend: "Weekend Trip",
};

export const COMMITMENT_ICONS: Record<CommitmentTier, string> = {
  hour: "⚡",
  halfday: "🌤",
  fullday: "☀️",
  weekend: "🏕",
};

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  easy: "Easy",
  moderate: "Moderate",
  hard: "Hard",
  expert: "Expert",
};

export const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  easy: "text-emerald-700 bg-emerald-50 border-emerald-200",
  moderate: "text-amber-700 bg-amber-50 border-amber-200",
  hard: "text-orange-700 bg-orange-50 border-orange-200",
  expert: "text-red-700 bg-red-50 border-red-200",
};

export const PARKING_LABELS: Record<ParkingType, string> = {
  free_lot: "Free Parking Lot",
  paid_lot: "Paid Parking",
  street: "Street Parking",
  garage: "Parking Garage",
  none: "No Parking",
};

export const BEST_TIME_LABELS: Record<BestTimeOfDay, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  any: "Any Time",
};

export const FAMILY_SUITABILITY_LABELS: Record<FamilySuitability, string> = {
  yes: "Family Friendly",
  no: "Not Family Friendly",
  caution: "Use Caution With Kids",
};

export function formatTrailLength(miles: number | null): string {
  if (miles === null) return "";
  if (miles < 1) return `${(miles * 5280).toFixed(0)} ft`;
  return `${miles % 1 === 0 ? miles : miles.toFixed(1)} mi`;
}
