import type { Portal } from "@/lib/portal-context";

type TypeLabelMap = Record<string, string>;

const DEFAULT_TYPE_LABELS: TypeLabelMap = {
  jurisdiction: "Jurisdiction",
  institution: "Institution",
  topic: "Topic",
  community: "Community",
  intent: "Intent",
};

function getSettingsObject(portal: Portal): Record<string, unknown> {
  return portal.settings && typeof portal.settings === "object"
    ? (portal.settings as Record<string, unknown>)
    : {};
}

function getSettingString(
  settings: Record<string, unknown>,
  key: string,
): string | null {
  const value = settings[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getTypeLabels(settings: Record<string, unknown>): TypeLabelMap {
  const raw = settings.interest_channel_type_labels;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_TYPE_LABELS;
  }

  const overrides = Object.entries(raw as Record<string, unknown>).reduce<TypeLabelMap>(
    (acc, [key, value]) => {
      if (typeof value === "string" && value.trim().length > 0) {
        acc[key] = value;
      }
      return acc;
    },
    {},
  );

  return {
    ...DEFAULT_TYPE_LABELS,
    ...overrides,
  };
}

export function getInterestChannelPresentation(portal: Portal) {
  const settings = getSettingsObject(portal);
  const channelsLabel = getSettingString(settings, "interest_channels_label") || "Interest Channels";
  const groupsPageTitle = getSettingString(settings, "groups_page_title") || "Groups";
  const feedTitle = getSettingString(settings, "interest_channels_feed_title") || "Join Groups";
  const allGroupsLabel = getSettingString(settings, "interest_channels_see_all_label") || "All groups";
  const joinedGroupsLabel = getSettingString(settings, "joined_channels_label") || "Joined Groups";
  const searchPlaceholder = getSettingString(settings, "interest_channels_search_placeholder")
    || "Search groups";

  return {
    channelsLabel,
    groupsPageTitle,
    feedTitle,
    allGroupsLabel,
    joinedGroupsLabel,
    searchPlaceholder,
    typeLabels: getTypeLabels(settings),
  };
}

export function getInterestChannelTypeLabel(
  portal: Portal,
  channelType: string,
): string {
  const presentation = getInterestChannelPresentation(portal);
  return presentation.typeLabels[channelType] || channelType;
}
