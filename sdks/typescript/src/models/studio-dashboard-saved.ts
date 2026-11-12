import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type StudioDashboardSaved = {
  version: number;
  updatedAt: Date;
  serverTime: Date;
};

const studioDashboardSavedProperties: s.Shape<StudioDashboardSaved> = {
  version: s.int(),
  updatedAt: s.dateTime(),
  serverTime: s.dateTime(),
  _keysMap: {
    updatedAt: "updated_at",
    serverTime: "server_time",
  },
};

export const studioDashboardSavedInternalSchema: Schema<StudioDashboardSaved> =
  s.object<StudioDashboardSaved>(studioDashboardSavedProperties);

export const studioDashboardSavedSchema: Schema<StudioDashboardSaved> = s.lazySchema(() =>
  s.object<StudioDashboardSaved>({
    ...studioDashboardSavedProperties,
    version: s.int().check(s.gte(1)),
  }),
);
