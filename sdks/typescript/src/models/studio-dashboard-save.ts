import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { state3InternalSchema, state3Schema, type State3 } from "./state3.js";

export type StudioDashboardSave = {
  /**
   * AG Studio's serialized report state (AgReportState): pages with their widgets, widget layout
   * and format. The server stores it as given and does not interpret Studio's schema; at most
   * 200,000 bytes as JSON (413 PAYLOAD_TOO_LARGE). It never holds data rows.
   */
  state: State3;
  /**
   * The version this save replaces: the version last read or saved, 0 when nothing is saved yet.
   * 409 INVALID_STATE when the stored version differs (saved meanwhile from another window or
   * device).
   */
  version: number;
};

const studioDashboardSaveProperties: s.Shape<StudioDashboardSave> = {
  state: state3InternalSchema,
  version: s.int(),
};

export const studioDashboardSaveInternalSchema: Schema<StudioDashboardSave> = s.object<StudioDashboardSave>(
  studioDashboardSaveProperties,
);

export const studioDashboardSaveSchema: Schema<StudioDashboardSave> = s.lazySchema(() =>
  s.object<StudioDashboardSave>({
    ...studioDashboardSaveProperties,
    state: state3Schema,
    version: s.int().check(s.gte(0)),
  }),
);
