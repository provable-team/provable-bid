import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

export const View = {
  Desktop: "desktop",
  Phone: "phone",
} as const;
export type View = (typeof View)[keyof typeof View] | (string & {});

export const viewSchema: EnumSchema<View> = s.enumOf<View>(View);
