import * as s from "../../core/validation/index.js";
import type { Schema } from "../../core/validation/schema.js";
import { studioAiItemInternalSchema, studioAiItemSchema, type StudioAiItem } from "../studio-ai-item.js";
import { studioAiItem1InternalSchema, studioAiItem1Schema, type StudioAiItem1 } from "../studio-ai-item1.js";
import { studioAiItem2InternalSchema, studioAiItem2Schema, type StudioAiItem2 } from "../studio-ai-item2.js";

/**
 * One conversation item. message: text from the user, the system or the assistant. tool_call: a
 * tool the assistant called, with its JSON-encoded arguments. tool_result: what the page returned
 * for that call.
 */
export type StudioAiItem3 = StudioAiItem | StudioAiItem1 | StudioAiItem2;

export const studioAiItem3InternalSchema: Schema<StudioAiItem3> = s.of<StudioAiItem3>(
  s.union([
    s.lazy(() => studioAiItemInternalSchema),
    s.lazy(() => studioAiItem1InternalSchema),
    s.lazy(() => studioAiItem2InternalSchema),
  ]),
);

export const studioAiItem3Schema: Schema<StudioAiItem3> = s.lazySchema(() =>
  s.of<StudioAiItem3>(
    s.union([
      s.lazy(() => studioAiItemSchema),
      s.lazy(() => studioAiItem1Schema),
      s.lazy(() => studioAiItem2Schema),
    ]),
  ),
);
