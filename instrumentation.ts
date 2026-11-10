// Runs once when the server starts. Checks for deliveries due for auto-release every 10 minutes while awake.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { sweepAutoRelease } = await import("@/lib/auto-release");
  const timer = setInterval(() => void sweepAutoRelease(), 10 * 60_000);
  timer.unref();
  void sweepAutoRelease();
}
