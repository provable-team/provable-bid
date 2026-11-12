import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { allocationInternalSchema, allocationSchema, type Allocation } from "./allocation.js";

export type AllocationPage = {
  items: Allocation[];
  nextCursor: string | null;
  serverTime: Date;
};

const allocationPageProperties: s.Shape<AllocationPage> = {
  items: s.array(s.lazy(() => allocationInternalSchema)),
  nextCursor: s.nullable(s.string()),
  serverTime: s.dateTime(),
  _keysMap: {
    nextCursor: "next_cursor",
    serverTime: "server_time",
  },
};

export const allocationPageInternalSchema: Schema<AllocationPage> =
  s.object<AllocationPage>(allocationPageProperties);

export const allocationPageSchema: Schema<AllocationPage> = s.lazySchema(() =>
  s.object<AllocationPage>({
    ...allocationPageProperties,
    items: s.array(s.lazy(() => allocationSchema)),
  }),
);
