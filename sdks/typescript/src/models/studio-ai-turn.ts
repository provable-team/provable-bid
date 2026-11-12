import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { status4Schema, type Status4 } from "./status4.js";
import { output2Schema, type Output2 } from "./unions/output2.js";
import { usageInternalSchema, usageSchema, type Usage } from "./usage.js";

export type StudioAiTurn = {
  id: string;
  /** The model that answered (fixed server-side). */
  model: string;
  /** incomplete: the turn hit its output cap. refused: the model declined; output is empty. */
  status: Status4;
  output: Output2[];
  usage: Usage;
  serverTime: Date;
};

const studioAiTurnProperties: s.Shape<StudioAiTurn> = {
  id: s.string(),
  model: s.string(),
  status: status4Schema,
  output: s.array(s.lazy(() => output2Schema)),
  usage: usageInternalSchema,
  serverTime: s.dateTime(),
  _keysMap: {
    serverTime: "server_time",
  },
};

export const studioAiTurnInternalSchema: Schema<StudioAiTurn> =
  s.object<StudioAiTurn>(studioAiTurnProperties);

export const studioAiTurnSchema: Schema<StudioAiTurn> = s.lazySchema(() =>
  s.object<StudioAiTurn>({
    ...studioAiTurnProperties,
    output: s.array(s.lazy(() => output2Schema)).check(s.maxLength(64)),
    usage: usageSchema,
  }),
);
