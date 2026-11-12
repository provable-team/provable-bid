import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { modeSchema, type Mode } from "./mode.js";

export type Health = {
  /** @default "ok" */
  status?: "ok";
  mode: Mode;
  serverTime: Date;
};

export const healthSchema: Schema<Health> = s.object<Health>({
  status: s.defaulted(s.literal("ok"), "ok"),
  mode: modeSchema,
  serverTime: s.dateTime(),
  _keysMap: {
    serverTime: "server_time",
  },
});
