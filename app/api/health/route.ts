import { count } from "drizzle-orm";
import { connection } from "next/server";
import { getDb, t } from "@/lib/db";

// Cheap liveness check for Render. Doesn't call PayPal.
export async function GET() {
  await connection(); // otherwise this is prerendered with build-time counts
  const db = getDb();
  return Response.json({
    ok: true,
    jobs: db.select({ n: count() }).from(t.jobs).get()!.n,
    agents: db.select({ n: count() }).from(t.agents).get()!.n,
  });
}
