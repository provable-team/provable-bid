import * as s from "../core/validation/index.js";
import type { JsonValue, Schema } from "../core/validation/schema.js";

/**
 * AG Studio's serialized report state (AgReportState): pages with their widgets, widget layout and
 * format. The server stores it as given and does not interpret Studio's schema; at most 200,000
 * bytes as JSON (413 PAYLOAD_TOO_LARGE). It never holds data rows.
 */
export type State3 = {
  pages: Record<string, unknown>[];
  selectedPageId?: string;
  /** Properties the service sent or accepts beyond those declared. */
  additionalProperties?: Record<string, JsonValue>;
};

const state3Properties: s.Shape<State3> = {
  pages: s.array(s.record(s.string(), s.unknown())),
  selectedPageId: s.optional(s.string()),
};

export const state3InternalSchema: Schema<State3> = s.object<State3>(state3Properties, {
  additionalProperties: s.json(),
});

export const state3Schema: Schema<State3> = s.lazySchema(() =>
  s.object<State3>(
    {
      ...state3Properties,
      pages: s.array(s.record(s.string(), s.unknown())).check(s.minLength(1), s.maxLength(50)),
      selectedPageId: s.optional(s.string().check(s.maxLength(200))),
    },
    { additionalProperties: s.json() },
  ),
);
