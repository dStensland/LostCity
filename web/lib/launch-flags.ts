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
