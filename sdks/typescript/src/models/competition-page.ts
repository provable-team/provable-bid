import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { competitionInternalSchema, competitionSchema, type Competition } from "./competition.js";

export type CompetitionPage = {
  items: Competition[];
  nextCursor: string | null;
  serverTime: Date;
};

const competitionPageProperties: s.Shape<CompetitionPage> = {
  items: s.array(s.lazy(() => competitionInternalSchema)),
  nextCursor: s.nullable(s.string()),
  serverTime: s.dateTime(),
  _keysMap: {
    nextCursor: "next_cursor",
    serverTime: "server_time",
  },
};

export const competitionPageInternalSchema: Schema<CompetitionPage> =
  s.object<CompetitionPage>(competitionPageProperties);

export const competitionPageSchema: Schema<CompetitionPage> = s.lazySchema(() =>
  s.object<CompetitionPage>({
    ...competitionPageProperties,
    items: s.array(s.lazy(() => competitionSchema)),
  }),
);
