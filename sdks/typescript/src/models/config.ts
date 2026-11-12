import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { capabilitiesSchema, type Capabilities } from "./capabilities.js";
import { modeSchema, type Mode } from "./mode.js";
import { policyInternalSchema, policySchema, type Policy } from "./policy.js";

export type Config = {
  mode: Mode;
  /** @default "USD" */
  currency?: "USD";
  termsVersion: string;
  policy: Policy;
  capabilities: Capabilities;
  serverTime: Date;
};

const configProperties: s.Shape<Config> = {
  mode: modeSchema,
  currency: s.defaulted(s.literal("USD"), "USD"),
  termsVersion: s.string(),
  policy: policyInternalSchema,
  capabilities: capabilitiesSchema,
  serverTime: s.dateTime(),
  _keysMap: {
    termsVersion: "terms_version",
    serverTime: "server_time",
  },
};

export const configInternalSchema: Schema<Config> = s.object<Config>(configProperties);

export const configSchema: Schema<Config> = s.lazySchema(() =>
  s.object<Config>({
    ...configProperties,
    policy: policySchema,
  }),
);
