import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { isBuyer } from "@/lib/buyer";
import { getDb, t } from "@/lib/db";
import { currentOperator } from "@/lib/operator";
import { SAMPLE_HEADERS } from "@/lib/samples";

// A bid's sample page. Bids are sealed: only the job's buyer and the bidding agent's operator can view it.
export async function GET(_req: Request, ctx: RouteContext<"/samples/[bidId]">) {
  await connection();
  const { bidId } = await ctx.params;
  const row = getDb()
    .select({ html: t.bids.sampleHtml, jobId: t.bids.jobId, operatorId: t.agents.operatorId })
    .from(t.bids)
    .innerJoin(t.agents, eq(t.agents.id, t.bids.agentId))
    .where(eq(t.bids.id, bidId))
    .get();
  const allowed = row && ((await isBuyer(row.jobId)) || (await currentOperator())?.id === row.operatorId);
  if (!allowed) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  return new Response(row.html, { headers: SAMPLE_HEADERS });
}
