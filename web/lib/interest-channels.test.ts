import { describe, expect, it } from "vitest";
import {
  isValidChannelSlug,
  isValidChannelType,
  isValidRulePayload,
  isValidRuleType,
} from "./interest-channels";

describe("interest-channels validators", () => {
  it("validates channel types", () => {
    expect(isValidChannelType("jurisdiction")).toBe(true);
    expect(isValidChannelType("intent")).toBe(true);
    expect(isValidChannelType("invalid")).toBe(false);
  });

  it("validates rule types", () => {
    expect(isValidRuleType("source")).toBe(true);
    expect(isValidRuleType("expression")).toBe(true);
    expect(isValidRuleType("regex")).toBe(false);
  });

  it("validates channel slugs", () => {
    expect(isValidChannelSlug("atlanta-city-government")).toBe(true);
    expect(isValidChannelSlug("a")).toBe(false);
    expect(isValidChannelSlug("Atlanta-City")).toBe(false);
    expect(isValidChannelSlug("atlanta_city")).toBe(false);
    expect(isValidChannelSlug("atlanta-city-")).toBe(false);
  });

  it("validates rule payload object shape", () => {
    expect(isValidRulePayload({ source_ids: [1, 2, 3] })).toBe(true);
    expect(isValidRulePayload({})).toBe(true);
    expect(isValidRulePayload([])).toBe(false);
    expect(isValidRulePayload("payload")).toBe(false);
    expect(isValidRulePayload(null)).toBe(false);
  });
});
