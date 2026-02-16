/**
 * Dog portal source policy.
 *
 * The dog portal federates from the base Atlanta data layer,
 * filtering through dog-relevant tags and vibes. Dog-primary
 * sources (shelters, pet stores) are added to Atlanta and
 * tagged so the portal picks them up automatically.
 */

/** Sources that exist primarily for dog/pet content */
export const DOG_PRIMARY_SOURCES = [
  "lifeline-animal-project",
  "atlanta-humane-society",
  "paws-atlanta",
  "furkids",
  "petco-atlanta",
  "petsmart-atlanta",
  "fetch-dog-park",
] as const;

/** Tags that mark an event as dog-relevant */
export const DOG_RELEVANT_TAGS = [
  "pets",
  "dog-friendly",
  "adoption",
  "dog-training",
  "off-leash",
  "animals",
] as const;

/** Vibes that mark a venue as dog-relevant */
export const DOG_RELEVANT_VIBES = ["dog-friendly"] as const;

/** Venue types that are inherently dog-relevant */
export const DOG_VENUE_TYPES = [
  "dog_park",
  "pet_store",
  "animal_shelter",
  "vet",
  "groomer",
  "pet_daycare",
] as const;

/** Check if a source slug is a dog-primary source */
export function isDogPrimarySource(sourceSlug: string): boolean {
  return (DOG_PRIMARY_SOURCES as readonly string[]).includes(sourceSlug);
}

/** Check if tags contain dog-relevant content */
export function hasDogRelevantTags(tags: string[] | null | undefined): boolean {
  if (!tags || tags.length === 0) return false;
  return tags.some((t) =>
    (DOG_RELEVANT_TAGS as readonly string[]).includes(t)
  );
}

/** Check if vibes contain dog-relevant content */
export function hasDogRelevantVibes(
  vibes: string[] | null | undefined
): boolean {
  if (!vibes || vibes.length === 0) return false;
  return vibes.some((v) =>
    (DOG_RELEVANT_VIBES as readonly string[]).includes(v)
  );
}
