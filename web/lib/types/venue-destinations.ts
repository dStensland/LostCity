// Venue destination details — maps to venue_destination_details table
// 1:1 extension table for venues in the Adventure portal

export type CommitmentLevel = "hour" | "halfday" | "fullday" | "weekend";

export type Difficulty = "easy" | "moderate" | "challenging" | "expert";

export type ParkingType = "free_lot" | "paid_lot" | "street" | "garage" | "none";

export type BestTimeOfDay = "morning" | "afternoon" | "evening" | "any";

export interface VenueDestinationDetails {
  venue_id: number;
  commitment_level: CommitmentLevel | null;
  difficulty: Difficulty | null;
  trail_length_miles: number | null;
  conditions_notes: string | null;
  accessibility_notes: string | null;
  parking_type: ParkingType | null;
  parking_capacity: number | null;
  seasonal_availability: string[] | null;
  best_time_of_day: BestTimeOfDay | null;
  dog_friendly: boolean | null;
  kid_friendly: boolean | null;
  metadata: Record<string, unknown>;
  updated_at: string;
}

// Display helpers

export const COMMITMENT_LABELS: Record<CommitmentLevel, string> = {
  hour: "Quick Visit",
  halfday: "Half Day",
  fullday: "Full Day",
  weekend: "Weekend Trip",
};

export const COMMITMENT_ICONS: Record<CommitmentLevel, string> = {
  hour: "⚡",
  halfday: "🌤",
  fullday: "☀️",
  weekend: "🏕",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  moderate: "Moderate",
  challenging: "Challenging",
  expert: "Expert",
};

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: "text-emerald-700 bg-emerald-50 border-emerald-200",
  moderate: "text-amber-700 bg-amber-50 border-amber-200",
  challenging: "text-orange-700 bg-orange-50 border-orange-200",
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

export function formatTrailLength(miles: number | null): string {
  if (miles === null) return "";
  if (miles < 1) return `${(miles * 5280).toFixed(0)} ft`;
  return `${miles % 1 === 0 ? miles : miles.toFixed(1)} mi`;
}
