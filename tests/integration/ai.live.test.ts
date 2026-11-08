import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  vultrConfigFromEnv,
  VultrInferenceProvider,
} from "../../packages/ai/src/index";

/**
 * Live Vultr inference probe. Runs ONLY when VULTR_INFERENCE_API_KEY is
 * present; otherwise skips cleanly. One tiny call (~40 tokens, <$0.0001)
 * verifying model identity — never report a requested model as executed
 * without this confirmation.
 */
const { config, hasKey } = vultrConfigFromEnv(process.env);
const LIVE = hasKey && process.env["AI_LIVE_TEST"] !== "0";
const describeLive = LIVE ? describe : describe.skip;

describeLive("ai live inference", () => {
  it(
    "serves the requested model with usage accounting",
    async () => {
      const provider = new VultrInferenceProvider({ ...config, maxTokens: 256 });
      const result = await provider.generateStructured({
        task: "incident-intelligence",
        system: 'Reply with exactly {"pong": true} and nothing else.',
        user: { ping: true },
        schema: z.object({ pong: z.boolean() }),
        schemaName: "Ping",
        maxAttempts: 2,
      });
      expect(result.provenance.modelServed).toBe(config.model);
      expect(result.provenance.fallbackUsed).toBe(false);
      expect(result.provenance.promptTokens).toBeGreaterThan(0);
      expect(result.data).toEqual({ pong: true });
    },
    60_000,
  );
});
