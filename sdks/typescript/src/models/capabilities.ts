import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { operatorOnboardingSchema, type OperatorOnboarding } from "./operator-onboarding.js";
import { payoutsSchema, type Payouts } from "./payouts.js";

export type Capabilities = {
  authorization: boolean;
  additionalCheckout: boolean;
  externalAgents: boolean;
  /** simulated only with the fake provider. */
  payouts: Payouts;
  /** False means requirements are judged by the deterministic fallback evaluator. */
  aiEvaluation: boolean;
  /** Labelled house agents are active and enter every competition. */
  houseAgents: boolean;
  operatorOnboarding: OperatorOnboarding;
  /**
   * Entries are rendered in a real browser (KERNEL): screenshot-only previews, measured checks for
   * the judge, and a browser_check summary on each rendered submission.
   */
  browserPreviews: boolean;
  /**
   * POST /v1/operators/me/assistant is enabled (Claude + PayPal Agent Toolkit; needs an Anthropic
   * key and the PayPal provider).
   */
  operatorAssistant: boolean;
  /**
   * POST /v1/operators/me/studio-ai/turns is available: the operator dashboard's AI assistant can
   * build and change widgets.
   */
  studioAi: boolean;
};

export const capabilitiesSchema: Schema<Capabilities> = s.object<Capabilities>({
  authorization: s.boolean(),
  additionalCheckout: s.boolean(),
  externalAgents: s.boolean(),
  payouts: payoutsSchema,
  aiEvaluation: s.boolean(),
  houseAgents: s.boolean(),
  operatorOnboarding: operatorOnboardingSchema,
  browserPreviews: s.boolean(),
  operatorAssistant: s.boolean(),
  studioAi: s.boolean(),
  _keysMap: {
    additionalCheckout: "additional_checkout",
    externalAgents: "external_agents",
    aiEvaluation: "ai_evaluation",
    houseAgents: "house_agents",
    operatorOnboarding: "operator_onboarding",
    browserPreviews: "browser_previews",
    operatorAssistant: "operator_assistant",
    studioAi: "studio_ai",
  },
});
