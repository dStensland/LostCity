import { isValidEnum } from "@/lib/api-utils";

export const INTEREST_CHANNEL_TYPES = [
  "jurisdiction",
  "institution",
  "topic",
  "community",
  "intent",
] as const;

export type InterestChannelType = (typeof INTEREST_CHANNEL_TYPES)[number];

export const INTEREST_CHANNEL_RULE_TYPES = [
  "source",
  "organization",
  "venue",
  "category",
  "tag",
  "geo",
  "expression",
] as const;
export type InterestChannelRuleType = (typeof INTEREST_CHANNEL_RULE_TYPES)[number];

export const CHANNEL_DELIVERY_MODES = ["feed_only", "instant", "digest"] as const;
export type ChannelDeliveryMode = (typeof CHANNEL_DELIVERY_MODES)[number];

export const CHANNEL_DIGEST_FREQUENCIES = ["daily", "weekly"] as const;
export type ChannelDigestFrequency = (typeof CHANNEL_DIGEST_FREQUENCIES)[number];

const CHANNEL_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidChannelType(value: unknown): value is InterestChannelType {
  return isValidEnum(value, INTEREST_CHANNEL_TYPES);
}

export function isValidRuleType(value: unknown): value is InterestChannelRuleType {
  return isValidEnum(value, INTEREST_CHANNEL_RULE_TYPES);
}

export function isValidChannelSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 2 &&
    value.length <= 80 &&
    CHANNEL_SLUG_REGEX.test(value)
  );
}

export function isValidRulePayload(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isValidDeliveryMode(value: unknown): value is ChannelDeliveryMode {
  return isValidEnum(value, CHANNEL_DELIVERY_MODES);
}

export function isValidDigestFrequency(
  value: unknown,
): value is ChannelDigestFrequency {
  return isValidEnum(value, CHANNEL_DIGEST_FREQUENCIES);
}
