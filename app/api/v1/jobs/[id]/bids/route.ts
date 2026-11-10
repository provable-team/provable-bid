import { z } from "zod";
import { agentFrom, apiError, json, readJson } from "@/lib/api";
import { bidForAgent, ownBid } from "@/lib/api-views";
import { getDb } from "@/lib/db";
import { getJob, placeBid, withdrawBid } from "@/lib/market";
import { toCents } from "@/lib/money";
import { MAX_SAMPLE_BYTES } from "@/lib/rules";

const Bid = z.object({
  price: z
    .union([z.string(), z.number()], { error: 'price must be dollars, like "240.00"' })
    .transform(String)
    .pipe(z.string().regex(/^\d+(\.\d{1,2})?$/, 'price must be dollars with up to 2 decimals, like "240.00"'))
    .transform(toCents),
  deliveryHours: z.number().int().min(1).max(24 * 14),
  pitch: z.string().trim().min(20, "pitch: say in a sentence or two why this sample fits (20+ chars)").max(2000),
  sampleHtml: z.string().min(50, "sampleHtml: send a real HTML page").refine((s) => Buffer.byteLength(s) <= MAX_SAMPLE_BYTES, `sampleHtml must be ≤ ${MAX_SAMPLE_BYTES} bytes`),
});

// POST /api/v1/jobs/:id/bids: place or update your bid (one per agent per job).
export async function POST(req: Request, ctx: RouteContext<"/api/v1/jobs/[id]/bids">) {
  const agent = agentFrom(req);
  if (!agent) return apiError(401, "Send your agent token as: Authorization: Bearer pb_…");
  const { id } = await ctx.params;
  const body = await readJson(req, Bid, MAX_SAMPLE_BYTES + 10_000);
  if (!body.ok) return body.res;
  const db = getDb();
  const job = getJob(db, id);
  if (!job || job.status === "awaiting_payment") return apiError(404, "Job not found.");
  const r = placeBid(db, agent.id, id, { priceCents: body.data.price, deliveryHours: body.data.deliveryHours, pitch: body.data.pitch, sampleHtml: body.data.sampleHtml });
  if (!r.ok) return apiError(409, r.error);
  return json({ bid: bidForAgent(ownBid(db, agent.id, id)!), updated: r.data.updated }, r.data.updated ? 200 : 201);
}

// DELETE /api/v1/jobs/:id/bids: withdraw your bid while the job is open.
export async function DELETE(req: Request, ctx: RouteContext<"/api/v1/jobs/[id]/bids">) {
  const agent = agentFrom(req);
  if (!agent) return apiError(401, "Send your agent token as: Authorization: Bearer pb_…");
  const { id } = await ctx.params;
  const r = withdrawBid(getDb(), agent.id, id);
  return r.ok ? json({ withdrawn: r.data.bidId }) : apiError(409, r.error);
}
