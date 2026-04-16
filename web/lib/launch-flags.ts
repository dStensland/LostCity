// Public analytics API remains disabled until post-launch.
export const ENABLE_EXTERNAL_ANALYTICS_API = process.env.ENABLE_EXTERNAL_ANALYTICS_API === "true";
export const ENABLE_INTEREST_CHANNELS_V1 = process.env.ENABLE_INTEREST_CHANNELS_V1 === "true";
// NEXT_PUBLIC_ prefix required: this flag is checked in client components (CityPulseShell, HangFeedSection, etc.)
export const ENABLE_HANGS_V1 =
  process.env.NEXT_PUBLIC_ENABLE_HANGS_V1 === "true" ||
  process.env.ENABLE_HANGS_V1 === "true";
// NEXT_PUBLIC_ prefix required: this flag is checked in client components (CityMomentUpload, UserAvatar, etc.)
export const ENABLE_CITY_MOMENTS =
  process.env.NEXT_PUBLIC_ENABLE_CITY_MOMENTS === "true" ||
  process.env.ENABLE_CITY_MOMENTS === "true";
// NEXT_PUBLIC_ prefix required: this flag is checked in client components (CommunityHub groups section, GroupDetail, etc.)
export const ENABLE_GROUPS_V1 =
  process.env.NEXT_PUBLIC_ENABLE_GROUPS_V1 === "true" ||
  process.env.ENABLE_GROUPS_V1 === "true";
// Server-only flag: read event pools from the pre-computed feed_events_ready table
// instead of the 4+ complex parallel queries. Set USE_FEED_READY_TABLE=true to enable.
export const USE_FEED_READY_TABLE =
  process.env.USE_FEED_READY_TABLE === "true";
// NEXT_PUBLIC_ prefix required: this flag is checked in client components (LineupSection).
// When ON, recurring/scene events pass through the Lineup and render as RecurringStrip below TieredEventList.
export const ENABLE_LINEUP_RECURRING =
  process.env.NEXT_PUBLIC_ENABLE_LINEUP_RECURRING === "true" ||
  process.env.ENABLE_LINEUP_RECURRING === "true";
// NEXT_PUBLIC_ prefix required: checked in EventDetailView (client component).
// When ON, event detail pages use the elevated shell (full-width hero + sticky rail).
// When OFF, events use the classic 340px sidebar shell.
export const ENABLE_ELEVATED_DETAIL =
  process.env.NEXT_PUBLIC_ENABLE_ELEVATED_DETAIL === "true" ||
  process.env.ENABLE_ELEVATED_DETAIL === "true";
