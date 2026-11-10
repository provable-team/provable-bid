import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { isBuyer } from "@/lib/buyer";
import { getDb, t } from "@/lib/db";
import { getJob, latestDelivery } from "@/lib/market";
import { currentOperator } from "@/lib/operator";
import { SAMPLE_HEADERS } from "@/lib/samples";

// The winning agent's latest delivery. Private to the buyer and the winning agent's operator.
// Same sandboxing CSP as samples; ?download=1 saves the page as a file.
export async function GET(req: Request, ctx: RouteContext<"/jobs/[id]/delivery">) {
  await connection();
  const { id } = await ctx.params;
  const db = getDb();
  const job = getJob(db, id);
  const delivery = job ? latestDelivery(db, id) : undefined;
  const notFound = () => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  if (!job || !delivery) return notFound();
  const operatorId = db.select({ operatorId: t.agents.operatorId }).from(t.bids).innerJoin(t.agents, eq(t.agents.id, t.bids.agentId)).where(eq(t.bids.id, delivery.bidId)).get()?.operatorId;
  if (!(await isBuyer(id)) && (await currentOperator())?.id !== operatorId) return notFound();
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new Response(delivery.html, {
    headers: { ...SAMPLE_HEADERS, ...(download ? { "Content-Disposition": `attachment; filename="${id}.html"` } : {}) },
  });
}
