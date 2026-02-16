import { getDogMapVenues } from "@/lib/dog-data";
import type { Spot } from "@/lib/spots-constants";
import DogMapViewClient from "./DogMapViewClient";

export default async function DogMapView() {
  const venues = await getDogMapVenues();

  const spots: Spot[] = venues.map((v) => ({
    id: v.id,
    name: v.name,
    slug: v.slug,
    address: v.address,
    neighborhood: v.neighborhood,
    city: "Atlanta",
    state: "GA",
    lat: v.lat,
    lng: v.lng,
    venue_type: v.venue_type,
    venue_types: null,
    description: v.short_description,
    short_description: v.short_description,
    price_level: null,
    website: v.website,
    instagram: null,
    hours_display: v.hours_display,
    vibes: v.vibes,
    genres: null,
    image_url: v.image_url,
    featured: false,
    active: true,
    claimed_by: null,
    is_verified: null,
  }));

  return <DogMapViewClient spots={spots} />;
}
