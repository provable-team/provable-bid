/**
 * Bring an operator back to the agent-activation page after Log in with PayPal, with its code. The API's login
 * callback always lands on /operators, so the activation page leaves a short-lived, same-tab note here first.
 * Only /operators/activate with an optional code is accepted, so this can never become an open redirect.
 */
const KEY = "provable.operator.return";
const MAX_AGE_MS = 15 * 60_000;
const SAFE_PATH = /^\/operators\/activate(\?code=[A-Za-z]{4}-?[A-Za-z]{0,4})?$/;

export function rememberOperatorReturn(path: string) {
  if (!SAFE_PATH.test(path)) return;
  try { sessionStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() })); } catch { /* storage unavailable: the operator re-enters the code */ }
}

/** One-shot: the activation page to return to, if one was noted in this tab in the last 15 minutes. */
export function takeOperatorReturn(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const { path, at } = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof path !== "string" || !SAFE_PATH.test(path) || typeof at !== "number" || !(Date.now() - at < MAX_AGE_MS) || at > Date.now()) return null;
    return path;
  } catch {
    return null;
  }
}

/** Upper-case letters only, at most eight, shown as XXXX-XXXX. */
export function formatUserCode(raw: string) {
  const letters = raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8);
  return letters.length > 4 ? `${letters.slice(0, 4)}-${letters.slice(4)}` : letters;
}
