import { describe, expect, it } from "vitest";
import { getInterestChannelPresentation, getInterestChannelTypeLabel } from "./interest-channel-presentation";
import type { Portal } from "@/lib/portal-context";

function buildPortal(settings: Record<string, unknown>): Portal {
  return {
    id: "portal-id",
    slug: "atlanta",
    name: "Atlanta",
    tagline: null,
    portal_type: "city",
    status: "live",
    visibility: "public",
    filters: {},
    branding: {},
    settings,
  } as Portal;
}

describe("interest-channel-presentation", () => {
  it("returns defaults when no custom settings exist", () => {
    const portal = buildPortal({});
    const presentation = getInterestChannelPresentation(portal);

    expect(presentation.channelsLabel).toBe("Interest Channels");
    expect(presentation.groupsPageTitle).toBe("Groups");
    expect(presentation.feedTitle).toBe("Join Groups");
    expect(presentation.allGroupsLabel).toBe("All groups");
    expect(presentation.joinedGroupsLabel).toBe("Joined Groups");
    expect(presentation.searchPlaceholder).toBe("Search groups");
    expect(presentation.typeLabels.topic).toBe("Topic");
  });

  it("uses portal-specific copy and type-label overrides", () => {
    const portal = buildPortal({
      interest_channels_label: "Scenes & Groups",
      groups_page_title: "Scenes",
      interest_channels_feed_title: "Follow Scenes",
      interest_channels_see_all_label: "All scenes",
      joined_channels_label: "Joined Scenes",
      interest_channels_search_placeholder: "Search scenes",
      interest_channel_type_labels: {
        topic: "Scene",
        community: "Group",
      },
    });

    const presentation = getInterestChannelPresentation(portal);

    expect(presentation.channelsLabel).toBe("Scenes & Groups");
    expect(presentation.groupsPageTitle).toBe("Scenes");
    expect(presentation.feedTitle).toBe("Follow Scenes");
    expect(presentation.allGroupsLabel).toBe("All scenes");
    expect(presentation.joinedGroupsLabel).toBe("Joined Scenes");
    expect(presentation.searchPlaceholder).toBe("Search scenes");
    expect(getInterestChannelTypeLabel(portal, "topic")).toBe("Scene");
    expect(getInterestChannelTypeLabel(portal, "community")).toBe("Group");
    expect(getInterestChannelTypeLabel(portal, "institution")).toBe("Institution");
  });
});
