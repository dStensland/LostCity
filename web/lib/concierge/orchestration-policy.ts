import { applyConciergeContentPolicy, type ConciergePolicyPortal } from "@/lib/concierge/content-policy";
import type { DayPart, FeedEvent as ConciergeFeedEvent, FeedSection as ConciergeFeedSection } from "@/lib/forth-types";
import type { FeedSection as OrchestratorFeedSection } from "@/lib/agents/concierge/types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function toEventId(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function sectionKey(section: { slug?: string | null; title?: string | null }): string {
  const slug = typeof section.slug === "string" ? section.slug.trim().toLowerCase() : "";
  if (slug) return `slug:${slug}`;
  const title = typeof section.title === "string" ? section.title.trim().toLowerCase() : "";
  return `title:${title}`;
}

function coercePolicyEvent(event: unknown): ConciergeFeedEvent | null {
  if (!isRecord(event)) return null;
  const id = toEventId(event.id);
  if (!id) return null;

  const title = typeof event.title === "string" && event.title.trim().length > 0
    ? event.title
    : "Untitled event";
  const startDate = typeof event.start_date === "string" ? event.start_date : "";
  const startTime = typeof event.start_time === "string" ? event.start_time : null;
  const imageUrl = typeof event.image_url === "string" ? event.image_url : null;
  const description = typeof event.description === "string" ? event.description : null;
  const venueName = typeof event.venue_name === "string" ? event.venue_name : null;
  const category = typeof event.category === "string" ? event.category : null;
  const isFree = typeof event.is_free === "boolean" ? event.is_free : false;
  const priceMin = typeof event.price_min === "number" ? event.price_min : null;
  const distanceKm = typeof event.distance_km === "number" ? event.distance_km : null;

  return {
    id,
    title,
    start_date: startDate,
    start_time: startTime,
    image_url: imageUrl,
    description,
    venue_name: venueName,
    category,
    is_free: isFree,
    price_min: priceMin,
    distance_km: distanceKm,
  };
}

function coercePolicySections(sections: OrchestratorFeedSection[]): ConciergeFeedSection[] {
  return sections
    .map((section, index) => {
      const events = Array.isArray(section.events)
        ? section.events.map(coercePolicyEvent).filter((event): event is ConciergeFeedEvent => event !== null)
        : [];

      if (events.length === 0) return null;

      const title = typeof section.title === "string" && section.title.trim().length > 0
        ? section.title
        : `Section ${index + 1}`;
      const slug = typeof section.slug === "string" && section.slug.trim().length > 0
        ? section.slug
        : undefined;

      if (slug) {
        return { title, slug, events };
      }
      return { title, events };
    })
    .filter((section): section is ConciergeFeedSection => section !== null);
}

function projectFilteredSections(
  rawSections: OrchestratorFeedSection[],
  filteredSections: ConciergeFeedSection[],
): OrchestratorFeedSection[] {
  const selectedIdsBySection = new Map<string, Set<string>>();

  for (const section of filteredSections) {
    const selectedIds = new Set(section.events.map((event) => toEventId(event.id)).filter(Boolean));
    if (selectedIds.size > 0) {
      selectedIdsBySection.set(sectionKey(section), selectedIds);
    }
  }

  return rawSections
    .map((section) => {
      const selectedIds = selectedIdsBySection.get(sectionKey(section));
      if (!selectedIds) return null;

      const events = Array.isArray(section.events)
        ? section.events.filter((event) => selectedIds.has(toEventId(event.id)))
        : [];

      if (events.length < 2) return null;
      const nextSection: OrchestratorFeedSection = { events };
      if (typeof section.title === "string" || section.title === null) {
        nextSection.title = section.title;
      }
      if (typeof section.slug === "string" || section.slug === null) {
        nextSection.slug = section.slug;
      }
      return nextSection;
    })
    .filter((section): section is OrchestratorFeedSection => section !== null);
}

export function filterOrchestrationSectionsByPolicy(
  portal: ConciergePolicyPortal,
  rawSections: OrchestratorFeedSection[],
  dayPart: DayPart,
): OrchestratorFeedSection[] {
  const policyInputSections = coercePolicySections(rawSections);
  const { aroundSections } = applyConciergeContentPolicy(portal, policyInputSections, dayPart);
  const filteredSections = projectFilteredSections(rawSections, aroundSections);
  return filteredSections.length > 0 ? filteredSections : rawSections;
}
