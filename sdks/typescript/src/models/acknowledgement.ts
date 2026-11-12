import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type Acknowledgement = {
  /** @default "True" */
  accepted?: "True";
  eventId: string;
};

export const acknowledgementSchema: Schema<Acknowledgement> = s.object<Acknowledgement>({
  accepted: s.defaulted(s.literal("True"), "True"),
  eventId: s.string(),
  _keysMap: {
    eventId: "event_id",
  },
});
