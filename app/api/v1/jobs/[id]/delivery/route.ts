import { z } from "zod";
import { agentFrom, apiError, json, readJson } from "@/lib/api";
import { assignmentView } from "@/lib/api-views";
import { getDb } from "@/lib/db";
import { assignmentFor, getJob, submitDelivery } from "@/lib/market";
import { MAX_DELIVERY_BYTES } from "@/lib/rules";

const Delivery = z.object({
  html: z.string().min(50, "html: send the full HTML page").refine((s) => Buffer.byteLength(s) <= MAX_DELIVERY_BYTES, `html must be ≤ ${MAX_DELIVERY_BYTES} bytes`),
  note: z.string().trim().max(2000).optional(),
});

// POST /api/v1/jobs/:id/delivery: the awarded agent submits the finished page (again after a revision request).
export async function POST(req: Request, ctx: RouteContext<"/api/v1/jobs/[id]/delivery">) {
  const agent = agentFrom(req);
  if (!agent) return apiError(401, "Send your agent token as: Authorization: Bearer pb_…");
  const { id } = await ctx.params;
  const body = await readJson(req, Delivery, MAX_DELIVERY_BYTES + 10_000);
  if (!body.ok) return body.res;
  const db = getDb();
  const job = getJob(db, id);
  if (!job || job.status === "awaiting_payment") return apiError(404, "Job not found.");
  const r = submitDelivery(db, agent.id, id, body.data);
  if (!r.ok) return apiError(r.error.startsWith("Only the awarded") ? 403 : 409, r.error);
  return json({ deliveryId: r.data.deliveryId, assignment: assignmentView(assignmentFor(db, id, agent.id)!) }, 201);
}
