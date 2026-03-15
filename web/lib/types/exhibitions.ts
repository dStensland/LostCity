// Exhibition entity types — maps to exhibitions + exhibition_artists tables

export type ExhibitionType =
  | "solo"
  | "group"
  | "installation"
  | "retrospective"
  | "popup"
  | "permanent";

export type AdmissionType = "free" | "ticketed" | "donation" | "suggested";

export type ArtistRole = "artist" | "curator" | "collaborator";

export interface Exhibition {
  id: string;
  slug: string;
  venue_id: number;
  source_id: number | null;
  portal_id: string | null;
  title: string;
  description: string | null;
  image_url: string | null;
  opening_date: string | null;
  closing_date: string | null;
  medium: string | null;
  exhibition_type: ExhibitionType | null;
  admission_type: AdmissionType | null;
  admission_url: string | null;
  source_url: string | null;
  tags: string[] | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ExhibitionArtist {
  exhibition_id: string;
  artist_name: string;
  artist_url: string | null;
  role: ArtistRole;
}

export interface ExhibitionWithVenue extends Exhibition {
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    address: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
    image_url: string | null;
  } | null;
  artists: ExhibitionArtist[];
}

// Display helpers

export const EXHIBITION_TYPE_LABELS: Record<ExhibitionType, string> = {
  solo: "Solo Show",
  group: "Group Show",
  installation: "Installation",
  retrospective: "Retrospective",
  popup: "Pop-Up",
  permanent: "Permanent Collection",
};

export const ADMISSION_TYPE_LABELS: Record<AdmissionType, string> = {
  free: "Free",
  ticketed: "Ticketed",
  donation: "Donation",
  suggested: "Suggested Donation",
};

export const ARTIST_ROLE_LABELS: Record<ArtistRole, string> = {
  artist: "Artist",
  curator: "Curator",
  collaborator: "Collaborator",
};

export function isCurrentlyShowing(exhibition: Exhibition): boolean {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  if (exhibition.opening_date && exhibition.opening_date > today) return false;
  if (exhibition.closing_date && exhibition.closing_date < today) return false;
  return true;
}

export function isClosingSoon(exhibition: Exhibition, daysThreshold = 14): boolean {
  if (!exhibition.closing_date) return false;
  const closing = new Date(exhibition.closing_date);
  const now = new Date();
  const daysUntilClose = (closing.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return daysUntilClose > 0 && daysUntilClose <= daysThreshold;
}

export function formatDateRange(
  opening: string | null,
  closing: string | null
): string {
  if (!opening && !closing) return "Ongoing";
  const fmt = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  if (opening && closing) return `${fmt(opening)} – ${fmt(closing)}`;
  if (opening) return `Opens ${fmt(opening)}`;
  return `Through ${fmt(closing!)}`;
}
