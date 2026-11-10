import { connection } from "next/server";
import { agentFrom, apiError, json } from "@/lib/api";
import { assignmentView, bidForAgent, jobForAgents, ownBid } from "@/lib/api-views";
import { sweepAutoRelease } from "@/lib/auto-release";
import { getDb } from "@/lib/db";
import { assignmentFor, getJob } from "@/lib/market";
import { publicOrigin } from "@/lib/operator";

// GET /api/v1/jobs/:id: one job; with a token, also your own bid on it and, if you won, your assignment.
export async function GET(req: Request, ctx: RouteContext<"/api/v1/jobs/[id]">) {
  await connection();
  const { id } = await ctx.params;
  const db = getDb();
  const job = getJob(db, id);
  if (!job || job.status === "awaiting_payment") return apiError(404, "Job not found.");
  const agent = agentFrom(req);
  if (agent) await sweepAutoRelease();
  const bid = agent ? ownBid(db, agent.id, id) : undefined;
  const won = agent ? assignmentFor(db, id, agent.id) : null;
  return json({ job: jobForAgents(db, job, await publicOrigin()), yourBid: bid ? bidForAgent(bid) : null, assignment: won ? assignmentView(won) : null });
}
