import { describe, expect, it } from "vitest";
import { AIService } from "../../packages/ai/src/index";
import { SCENARIOS } from "./scenarios";
import { runScenario, scriptedService } from "./harness";

/**
 * Offline AI eval: every scenario with a scripted behavior runs against a
 * stub provider (fixed model output or fixed failure). No network, no key,
 * deterministic — safe in CI.
 */
describe("AI eval suite (offline, scripted)", () => {
  it("covers at least 50 scenarios", () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(50);
    const live = SCENARIOS.filter((s) => s.live);
    expect(live.length).toBeGreaterThanOrEqual(20);
  });

  for (const scenario of SCENARIOS) {
    if (scenario.task === "provider-retry") {
      it(`offline/${scenario.id} — ${scenario.description}`, async () => {
        const outcome = await runScenario(scenario, new AIService(null), "offline");
        expect(outcome.checks.filter((c) => !c.pass)).toEqual([]);
        expect(outcome.pass).toBe(true);
      });
      continue;
    }
    const scripted = scenario.scripted;
    if (scripted === undefined) continue;
    it(`offline/${scenario.id} — ${scenario.description}`, async () => {
      const outcome = await runScenario(scenario, scriptedService(scripted), "offline");
      expect(outcome.checks.filter((c) => !c.pass)).toEqual([]);
      expect(outcome.pass).toBe(true);
    });
  }
});
