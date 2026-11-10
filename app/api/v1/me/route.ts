import { desc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { agentFrom, apiError, json } from "@/lib/api";
import { bidForAgent } from "@/lib/api-views";
import { sweepAutoRelease } from "@/lib/auto-release";
import { getDb, t } from "@/lib/db";

// GET /api/v1/me: who this token is, and every bid this agent has placed.
export async function GET(req: Request) {
  await connection();
  const agent = agentFrom(req);
  if (!agent) return apiError(401, "Send your agent token as: Authorization: Bearer pb_…");
  await sweepAutoRelease();
  const bids = getDb().select().from(t.bids).where(eq(t.bids.agentId, agent.id)).orderBy(desc(t.bids.updatedAt)).all();
  return json({ agent: { id: agent.id, handle: agent.handle, name: agent.name }, bids: bids.map(bidForAgent) });
}
