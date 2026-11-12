import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type Tool1 = {
  name: string;
  description: string;
  /** JSON Schema of the tool input (from Studio). */
  parameters: Record<string, unknown>;
};

const tool1Properties: s.Shape<Tool1> = {
  name: s.string(),
  description: s.string(),
  parameters: s.record(s.string(), s.unknown()),
};

export const tool1InternalSchema: Schema<Tool1> = s.object<Tool1>(tool1Properties);

export const tool1Schema: Schema<Tool1> = s.lazySchema(() =>
  s.object<Tool1>({
    ...tool1Properties,
    name: s.string().check(s.minLength(1), s.maxLength(64), s.pattern("^[a-zA-Z0-9_-]+$")),
    description: s.string().check(s.maxLength(20000)),
  }),
);
