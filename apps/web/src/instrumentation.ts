// Runs once when the Next.js server starts. Keep-alive for Render's free plan: free services sleep after
// 15 minutes without inbound traffic, so the web app and the API ping each other every 9 minutes.
// Set KEEP_ALIVE_URLS (comma-separated) on the web service to the API's /health URL; leave it empty to switch off.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const urls = (process.env.KEEP_ALIVE_URLS ?? "").split(",").map((u) => u.trim()).filter(Boolean);
  if (!urls.length) return;
  const ping = () => {
    for (const url of urls) void fetch(url, { cache: "no-store", signal: AbortSignal.timeout(60_000) }).catch(() => {});
  };
  const timer = setInterval(ping, 9 * 60_000);
  timer.unref?.();
  setTimeout(ping, 30_000).unref?.(); // wake the other side soon after a deploy
}
