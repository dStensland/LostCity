// Client-safe re-exports from the exhibitions type module.
// Import from this file in client components, not from @/lib/types/exhibitions.

export {
  isCurrentlyShowing,
  isClosingSoon,
  formatDateRange,
  EXHIBITION_TYPE_LABELS,
  ADMISSION_TYPE_LABELS,
  ARTIST_ROLE_LABELS,
} from "@/lib/types/exhibitions";

export type {
  Exhibition,
  ExhibitionWithVenue,
  ExhibitionArtist,
  ExhibitionType,
  AdmissionType,
  ArtistRole,
} from "@/lib/types/exhibitions";
