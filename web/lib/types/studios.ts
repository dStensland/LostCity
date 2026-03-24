// Studio types — studios are venues with studio_type set

export type StudioType = "private" | "shared" | "coop" | "residency" | "makerspace";
export type AvailabilityStatus = "open" | "waitlist" | "full" | "application_only";

export interface StudioVenue {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  venue_type: string;
  website: string | null;
  description: string | null;
  image_url: string | null;
  vibes: string[] | null;
  studio_type: StudioType;
  availability_status: AvailabilityStatus | null;
  monthly_rate_range: string | null;
  studio_application_url: string | null;
}

export const STUDIO_TYPE_LABELS: Record<StudioType, string> = {
  private: "Private Studio",
  shared: "Shared Space",
  coop: "Co-op",
  residency: "Residency Program",
  makerspace: "Makerspace",
};

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  open: "Open",
  waitlist: "Waitlist",
  full: "Full",
  application_only: "Application Only",
};

export const AVAILABILITY_COLORS: Record<AvailabilityStatus, string> = {
  open: "--neon-green",
  waitlist: "--gold",
  full: "--muted",
  application_only: "--action-primary",
};
