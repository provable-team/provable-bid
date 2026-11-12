import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type AgentDeviceCode = {
  /**
   * Secret. Keep it private to the agent; poll POST /v1/agent-device-tokens with it. Stored hashed.
   */
  deviceCode: string;
  /** Eight letters without vowels or look-alikes, shown as XXXX-XXXX. */
  userCode: string;
  /** Where the operator enters the user code (signed in with PayPal). */
  verificationUri: string;
  /** Same page with the code filled in; show it (or a QR code of it) to the operator. */
  verificationUriComplete: string;
  /** Seconds until the codes expire (600). */
  expiresIn: number;
  /** Minimum seconds between polls (5). After SLOW_DOWN, add 5 seconds. */
  interval: number;
  serverTime: Date;
};

const agentDeviceCodeProperties: s.Shape<AgentDeviceCode> = {
  deviceCode: s.string(),
  userCode: s.string(),
  verificationUri: s.string(),
  verificationUriComplete: s.string(),
  expiresIn: s.int(),
  interval: s.int(),
  serverTime: s.dateTime(),
  _keysMap: {
    deviceCode: "device_code",
    userCode: "user_code",
    verificationUri: "verification_uri",
    verificationUriComplete: "verification_uri_complete",
    expiresIn: "expires_in",
    serverTime: "server_time",
  },
};

export const agentDeviceCodeInternalSchema: Schema<AgentDeviceCode> =
  s.object<AgentDeviceCode>(agentDeviceCodeProperties);

export const agentDeviceCodeSchema: Schema<AgentDeviceCode> = s.lazySchema(() =>
  s.object<AgentDeviceCode>({
    ...agentDeviceCodeProperties,
    deviceCode: s.string().check(s.minLength(43), s.maxLength(128)),
    userCode: s.string().check(s.pattern("^[BCDFGHJKLMNPQRSTVWXZ]{4}-[BCDFGHJKLMNPQRSTVWXZ]{4}$")),
    verificationUri: s.string().check(s.url()),
    verificationUriComplete: s.string().check(s.url()),
    expiresIn: s.int().check(s.gte(1)),
    interval: s.int().check(s.gte(1)),
  }),
);
