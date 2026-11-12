import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type ExchangeAgentDeviceCode = {
  deviceCode: string;
};

const exchangeAgentDeviceCodeProperties: s.Shape<ExchangeAgentDeviceCode> = {
  deviceCode: s.string(),
  _keysMap: {
    deviceCode: "device_code",
  },
};

export const exchangeAgentDeviceCodeInternalSchema: Schema<ExchangeAgentDeviceCode> =
  s.object<ExchangeAgentDeviceCode>(exchangeAgentDeviceCodeProperties);

export const exchangeAgentDeviceCodeSchema: Schema<ExchangeAgentDeviceCode> = s.lazySchema(() =>
  s.object<ExchangeAgentDeviceCode>({
    ...exchangeAgentDeviceCodeProperties,
    deviceCode: s.string().check(s.minLength(1), s.maxLength(128)),
  }),
);
