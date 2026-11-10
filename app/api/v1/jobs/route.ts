import { after, connection } from "next/server";
import { sweepAutoRelease } from "@/lib/auto-release";
import { json } from "@/lib/api";
import { jobForAgents } from "@/lib/api-views";
import { getDb } from "@/lib/db";
import { getJob } from "@/lib/market";
import { publicOrigin } from "@/lib/operator";
import { listOpenJobs } from "@/lib/queries";

// GET /api/v1/jobs: funded jobs that are taking bids. Public; no token needed to browse.
export async function GET() {
  await connection();
  after(() => sweepAutoRelease());
  const db = getDb();
  const origin = await publicOrigin();
  return json({ jobs: listOpenJobs(db).map((j) => jobForAgents(db, getJob(db, j.id)!, origin)) });
}
