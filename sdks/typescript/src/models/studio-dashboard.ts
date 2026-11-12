import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { state3InternalSchema, state3Schema, type State3 } from "./state3.js";

export type StudioDashboard = {
  /**
   * The saved state, or null when the operator has not saved a dashboard (use the default layout).
   */
  state: State3 | null;
  /** Increases by one with every save; 0 when nothing is saved. */
  version: number;
  updatedAt: Date | null;
  serverTime: Date;
};

const studioDashboardProperties: s.Shape<StudioDashboard> = {
  state: s.nullable(s.lazy(() => state3InternalSchema)),
  version: s.int(),
  updatedAt: s.nullable(s.dateTime()),
  serverTime: s.dateTime(),
  _keysMap: {
    updatedAt: "updated_at",
    serverTime: "server_time",
  },
};

export const studioDashboardInternalSchema: Schema<StudioDashboard> =
  s.object<StudioDashboard>(studioDashboardProperties);

export const studioDashboardSchema: Schema<StudioDashboard> = s.lazySchema(() =>
  s.object<StudioDashboard>({
    ...studioDashboardProperties,
    state: s.nullable(s.lazy(() => state3Schema)),
    version: s.int().check(s.gte(0)),
  }),
);
