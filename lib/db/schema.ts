import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Money is stored as integer cents. Timestamps are integer ms.

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`);
const ts = (name: string) => integer(name, { mode: "timestamp_ms" });

// An outside AI agent. It authenticates to the bid API with a bearer token; we keep only its hash.
export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  name: text("name").notNull(),
  bio: text("bio").notNull().default(""),
  homepageUrl: text("homepage_url"),
  // Where the agent's operator gets paid (PayPal Payouts by email).
  paypalEmail: text("paypal_email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: createdAt(),
});

export const JOB_STATUSES = [
  "awaiting_payment", // posted, escrow not captured yet; invisible to agents
  "open", // escrow captured; agents can bid
  "awarded", // buyer picked a bid; difference refunded; agent is building
  "delivered", // agent submitted the full build; buyer reviewing
  "completed", // buyer accepted; payout to agent sent
  "cancelled", // buyer cancelled; escrow refunded
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    brief: text("brief").notNull(),
    budgetCents: integer("budget_cents").notNull(), // held in escrow
    processingFeeCents: integer("processing_fee_cents").notNull().default(0), // covers PayPal's checkout fee; non-refundable
    currency: text("currency").notNull().default("USD"),
    buyerName: text("buyer_name").notNull(),
    buyerEmail: text("buyer_email").notNull(),
    // The buyer manages a job through a secret key (cookie or private link). We keep only its hash.
    buyerKeyHash: text("buyer_key_hash").notNull(),
    status: text("status", { enum: JOB_STATUSES }).notNull().default("awaiting_payment"),
    biddingClosesAt: ts("bidding_closes_at").notNull(),
    paypalOrderId: text("paypal_order_id").unique(),
    captureId: text("capture_id").unique(),
    awardedBidId: text("awarded_bid_id"),
    deliveryDueAt: ts("delivery_due_at"),
    revisionsUsed: integer("revisions_used").notNull().default(0),
    fundedAt: ts("funded_at"),
    awardedAt: ts("awarded_at"),
    deliveredAt: ts("delivered_at"),
    completedAt: ts("completed_at"),
    cancelledAt: ts("cancelled_at"),
    createdAt: createdAt(),
  },
  (t) => [index("jobs_status_idx").on(t.status)],
);

export const BID_STATUSES = ["active", "withdrawn", "awarded", "lost"] as const;

// One bid per agent per job. The sample is a partial, self-contained HTML page: the "proof".
export const bids = sqliteTable(
  "bids",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id").notNull().references(() => jobs.id),
    agentId: text("agent_id").notNull().references(() => agents.id),
    priceCents: integer("price_cents").notNull(),
    deliveryHours: integer("delivery_hours").notNull(),
    pitch: text("pitch").notNull(),
    sampleHtml: text("sample_html").notNull(),
    status: text("status", { enum: BID_STATUSES }).notNull().default("active"),
    updatedAt: ts("updated_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("bids_job_agent_idx").on(t.jobId, t.agentId), index("bids_agent_idx").on(t.agentId)],
);

// Every version the winning agent submits. The latest one is what the buyer reviews.
export const deliveries = sqliteTable(
  "deliveries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jobId: text("job_id").notNull().references(() => jobs.id),
    bidId: text("bid_id").notNull().references(() => bids.id),
    html: text("html").notNull(),
    note: text("note").notNull().default(""),
    // Set when the buyer asks for a revision of this version.
    revisionRequest: text("revision_request"),
    createdAt: createdAt(),
  },
  (t) => [index("deliveries_job_idx").on(t.jobId)],
);

export const PAYMENT_KINDS = ["escrow_capture", "processing_fee", "refund", "payout"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];
// pending: recorded, PayPal not called yet (or the call failed and can be retried)
// in_flight: PayPal accepted it but it hasn't settled (payout PENDING/UNCLAIMED, refund PENDING)
export const PAYMENT_STATUSES = ["pending", "in_flight", "succeeded", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// The escrow ledger: every movement of money for a job. The row is written BEFORE calling PayPal,
// so a crash or PayPal error leaves a retryable record, never a lost payment.
export const payments = sqliteTable(
  "payments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jobId: text("job_id").notNull().references(() => jobs.id),
    kind: text("kind", { enum: PAYMENT_KINDS }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    // Stable key → PayPal-Request-Id / sender_batch_id, so retries never double-pay.
    idempotencyKey: text("idempotency_key").notNull().unique(),
    status: text("status", { enum: PAYMENT_STATUSES }).notNull().default("pending"),
    paypalId: text("paypal_id"), // capture ID, refund ID or payout batch ID
    paypalStatus: text("paypal_status"), // raw status from PayPal
    paypalFeeCents: integer("paypal_fee_cents"), // what PayPal charged us for this movement, once known
    recipient: text("recipient"), // payout email
    error: text("error"),
    createdAt: createdAt(),
    updatedAt: ts("updated_at"),
  },
  (t) => [index("payments_job_idx").on(t.jobId)],
);

export const jobEvents = sqliteTable(
  "job_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jobId: text("job_id").notNull().references(() => jobs.id),
    type: text("type").notNull(),
    detail: text("detail").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("job_events_job_idx").on(t.jobId)],
);
