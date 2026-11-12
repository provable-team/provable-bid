import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { blockInternalSchema, blockSchema, type Block } from "./block.js";
import { state1Schema, type State1 } from "./state1.js";

/**
 * Latest coarse build step of one house agent (internal: true) in this competition, derived from
 * the structure of its streamed page. Never contains generated text, markup, class names,
 * attributes or CSS; the only design information is the page's block structure (kinds and small
 * counts) and hex colours.
 */
export type BuildProgress = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  agentId: string;
  /** Increases by one with every change of label or state. */
  step: number;
  /**
   * Plain words, e.g. "writing the hero", "adding opening hours", "checking the page", "submitted".
   * Topic words come only from the buyer's own requirements.
   */
  label: string;
  /**
   * building: still working. submitted: entered, being checked. revising: its last attempt failed
   * and it is building a revised page (attempt is the new one). qualified / not_qualified: the
   * check finished and the agent is done. An agent that fails before ever submitting is removed
   * from the list.
   */
  state: State1;
  /** The attempt being built or checked (1 = first entry). */
  attempt: number;
  /** @default 3 */
  maxAttempts?: 3;
  /**
   * IDs of the buyer's requirements the latest failed attempt did not meet (from the buyer's own
   * brief; show the requirement text). Never the judge's reasons. Empty when nothing has failed or
   * a page failed the automatic gates.
   */
  missedRequirementIds: string[];
  /**
   * Up to 3 colours the agent's page is using so far: the first distinct hex values in its
   * background, color, border and custom-property declarations, normalized to #rrggbb, near-white
   * and near-black dropped. Design information shown before qualification. Empty until one is found
   * (clients fall back to the agent's avatar_color).
   */
  colors: string[];
  /**
   * The page's top-level blocks so far, in order, read from the structure of the streamed HTML.
   * Kinds and small integers only.
   */
  blocks: Block[];
  /**
   * Index of the block being written: the last one opened but not yet closed, else the newest. Null
   * before the first block.
   */
  currentBlock: number | null;
  /** Button background colour (button, .btn, .cta) when the CSS sets one. */
  accent: string | null;
  updatedAt: Date;
};

const buildProgressProperties: s.Shape<BuildProgress> = {
  agentId: s.string(),
  step: s.int(),
  label: s.string(),
  state: state1Schema,
  attempt: s.int(),
  maxAttempts: s.defaulted(s.literal(3), 3),
  missedRequirementIds: s.array(s.string()),
  colors: s.array(s.string()),
  blocks: s.array(s.lazy(() => blockInternalSchema)),
  currentBlock: s.nullable(s.int()),
  accent: s.nullable(s.string()),
  updatedAt: s.dateTime(),
  _keysMap: {
    agentId: "agent_id",
    maxAttempts: "max_attempts",
    missedRequirementIds: "missed_requirement_ids",
    currentBlock: "current_block",
    updatedAt: "updated_at",
  },
};

export const buildProgressInternalSchema: Schema<BuildProgress> =
  s.object<BuildProgress>(buildProgressProperties);

export const buildProgressSchema: Schema<BuildProgress> = s.lazySchema(() =>
  s.object<BuildProgress>({
    ...buildProgressProperties,
    agentId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    step: s.int().check(s.gte(0)),
    label: s.string().check(s.minLength(1), s.maxLength(48), s.pattern("^[a-z0-9 '-]+$")),
    attempt: s.int().check(s.gte(1), s.lte(3)),
    missedRequirementIds: s
      .array(s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")))
      .check(s.maxLength(20)),
    colors: s.array(s.string().check(s.pattern("^#[0-9a-f]{6}$"))).check(s.maxLength(3), s.uniqueItems()),
    blocks: s.array(s.lazy(() => blockSchema)).check(s.maxLength(12)),
    currentBlock: s.nullable(s.int().check(s.gte(0), s.lte(11))),
    accent: s.nullable(s.string().check(s.pattern("^#[0-9a-f]{6}$"))),
  }),
);
