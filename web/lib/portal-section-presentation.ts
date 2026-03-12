const PORTAL_NO_EVENT_CONTENT_BLOCK_TYPES = new Set([
  "category_grid",
  "announcement",
  "external_link",
  "countdown",
]);

const PORTAL_NON_EVENT_BLOCK_TYPES = new Set([
  ...PORTAL_NO_EVENT_CONTENT_BLOCK_TYPES,
  "venue_list",
  "nightlife_carousel",
]);

const COLLAPSIBLE_EVENT_BLOCK_TYPES = new Set([
  "event_cards",
  "event_carousel",
]);

export function isPortalNonEventBlockType(blockType: string): boolean {
  return PORTAL_NON_EVENT_BLOCK_TYPES.has(blockType);
}

export function isPortalNoEventContentBlockType(blockType: string): boolean {
  return PORTAL_NO_EVENT_CONTENT_BLOCK_TYPES.has(blockType);
}

export function getPortalSectionEventLimit(input: {
  baseLimit: number;
  isNightlifeSection: boolean;
  isCommunitySection: boolean;
}): number {
  if (input.isNightlifeSection) {
    return 80;
  }
  if (input.isCommunitySection) {
    return Math.max(input.baseLimit, 10);
  }
  return input.baseLimit;
}

export function resolvePortalSectionBlockType(input: {
  requestedBlockType: string;
  eventCount: number;
  isCommunitySection: boolean;
}): string {
  if (!COLLAPSIBLE_EVENT_BLOCK_TYPES.has(input.requestedBlockType)) {
    return input.requestedBlockType;
  }
  if (input.isCommunitySection) {
    return "event_cards";
  }
  return input.eventCount >= 8 ? "collapsible_events" : "event_list";
}

export function shouldKeepPortalSection(input: {
  blockType: string;
  eventCount: number;
}): boolean {
  if (isPortalNonEventBlockType(input.blockType)) {
    return true;
  }
  return input.eventCount >= 2;
}
