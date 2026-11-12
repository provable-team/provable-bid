import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import {
  assistantLookupInternalSchema,
  assistantLookupSchema,
  type AssistantLookup,
} from "./assistant-lookup.js";

export type AssistantAnswer = {
  /** Plain text. */
  answer: string;
  lookups: AssistantLookup[];
  serverTime: Date;
};

const assistantAnswerProperties: s.Shape<AssistantAnswer> = {
  answer: s.string(),
  lookups: s.array(s.lazy(() => assistantLookupInternalSchema)),
  serverTime: s.dateTime(),
  _keysMap: {
    serverTime: "server_time",
  },
};

export const assistantAnswerInternalSchema: Schema<AssistantAnswer> =
  s.object<AssistantAnswer>(assistantAnswerProperties);

export const assistantAnswerSchema: Schema<AssistantAnswer> = s.lazySchema(() =>
  s.object<AssistantAnswer>({
    ...assistantAnswerProperties,
    answer: s.string().check(s.maxLength(4000)),
    lookups: s.array(s.lazy(() => assistantLookupSchema)).check(s.maxLength(20)),
  }),
);
