import { describe, expect, it } from "vitest";
import { runPortalStudioOrchestration } from "@/lib/agents/portal-studio/orchestrator";

describe("runPortalStudioOrchestration", () => {
  const now = new Date("2026-02-12T12:00:00.000Z");

  it("enforces strategy locks for pre-launch foundation", () => {
    const output = runPortalStudioOrchestration({
      requestId: "PS-TEST-001",
      now,
      portal: {
        id: "portal-1",
        slug: "emory-demo",
        name: "Emory Demo",
        vertical: "hospital",
      },
      session: {
        lifecycle: "prototype",
        commercialFocus: "sales",
        wayfindingPartner: "gozio",
        excludedCompetitors: ["Piedmont"],
      },
    });

    expect(output.strategy_locks.strict_source_attribution).toBe(true);
    expect(output.strategy_locks.public_developer_api).toBe("iceboxed");
    expect(output.strategy_locks.self_serve_admin_generation).toBe("deferred_until_customer_validation");
    expect(output.non_goals.some((goal) => goal.toLowerCase().includes("public developer api"))).toBe(true);
    expect(output.execution_protocol.stages.length).toBeGreaterThanOrEqual(6);
    expect(output.quality_gates.some((gate) => gate.id === "brand_fidelity")).toBe(true);
    expect(output.feedback_learning_loop.required_actions.length).toBe(3);
  });

  it("builds hospital-specific journeys including wayfinding and public health layers", () => {
    const output = runPortalStudioOrchestration({
      requestId: "PS-TEST-002",
      now,
      portal: {
        id: "portal-2",
        slug: "emory-demo",
        name: "Emory Demo",
        vertical: "hospital",
      },
      session: {
        lifecycle: "pilot",
        commercialFocus: "engagement",
        wayfindingPartner: "gozio",
        excludedCompetitors: ["Piedmont"],
      },
    });

    const journeyText = output.blueprint.domain_experience.hero_journeys
      .map((item) => `${item.journey} ${item.objective}`)
      .join(" ")
      .toLowerCase();

    expect(journeyText).toContain("wayfinding");
    expect(journeyText).toContain("public-health");
    expect(output.blueprint.content_curation.exclusion_policy.join(" ").toLowerCase()).toContain("piedmont");
  });

  it("includes scale and security controls required for enterprise rollout", () => {
    const output = runPortalStudioOrchestration({
      requestId: "PS-TEST-003",
      now,
      portal: {
        id: "portal-3",
        slug: "forth",
        name: "FORTH",
        vertical: "hotel",
      },
      session: {
        lifecycle: "launch",
        commercialFocus: "operations",
        wayfindingPartner: "gozio",
        excludedCompetitors: [],
      },
    });

    expect(output.blueprint.architecture_scale.scale_controls.length).toBeGreaterThan(2);
    expect(output.blueprint.security_privacy.controls.join(" ").toLowerCase()).toContain("portal-scoped");
    expect(output.scorecard.launch_readiness_score).toBeGreaterThanOrEqual(90);
  });

  it("generates film-native guidance for curation and sponsor-safe monetization", () => {
    const output = runPortalStudioOrchestration({
      requestId: "PS-TEST-004",
      now,
      portal: {
        id: "portal-4",
        slug: "atlanta-film",
        name: "Atlanta Film",
        vertical: "film",
      },
      session: {
        lifecycle: "launch",
        commercialFocus: "sales",
        wayfindingPartner: "not_required",
        excludedCompetitors: ["Example Cinema Chain"],
      },
    });

    const journeys = output.blueprint.domain_experience.hero_journeys
      .map((item) => `${item.journey} ${item.objective}`)
      .join(" ")
      .toLowerCase();

    expect(journeys).toContain("screening");
    expect(output.blueprint.product_ux.conversion_stack.join(" ").toLowerCase()).toContain("showtimes");
    expect(output.quality_gates.some((gate) => gate.id === "sponsor_native_placement")).toBe(true);
    expect(output.blueprint.copywriting.voice_system.join(" ").toLowerCase()).toContain("critic-grade");
  });
});
