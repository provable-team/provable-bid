import "server-only";
import { getDb } from "@/lib/db";
import { releaseDueDeliveries, settleStragglers } from "@/lib/market";
import { paypalRail } from "@/lib/paypal/rail";

// Runs the 7-day auto-release, then follows up on unwatched refunds/payouts, at most once a minute per server. Triggered by a timer while the server
// is awake (instrumentation.ts) and by agent API calls and job page views, because Render's free plan
// sleeps the server and its timers when idle. Agents poll for their money, so they wake it.
const g = globalThis as unknown as { __autoReleaseAt?: number; __autoReleaseRunning?: boolean };

export async function sweepAutoRelease(now = new Date()) {
  if (g.__autoReleaseRunning || (g.__autoReleaseAt && now.getTime() - g.__autoReleaseAt < 60_000)) return [];
  g.__autoReleaseRunning = true;
  g.__autoReleaseAt = now.getTime();
  try {
    const released = await releaseDueDeliveries(getDb(), paypalRail, now);
    if (released.length) console.log(`[auto-release] accepted ${released.join(", ")} after 7 days without a buyer response`);
    await settleStragglers(getDb(), paypalRail, now);
    return released;
  } catch (err) {
    console.error("[auto-release] sweep failed:", err);
    return [];
  } finally {
    g.__autoReleaseRunning = false;
  }
}
