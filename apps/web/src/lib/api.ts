import {
  readQualifiedGallery,
  type createApiClient,
  type Problem,
  type components,
} from "@provable/api-client";

export type Api = ReturnType<typeof createApiClient>;
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code?: Problem["code"],
    public retryable = true,
    public requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const REQUEST_TIMEOUT_MS = 10_000;

/** Bound the complete operation, including response-body parsing. The race also
 * releases callers if an interrupted transport does not settle after abort. */
export async function withRequestTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const cancel = () => controller.abort(options.signal?.reason);
  let rejectAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener("abort", rejectAbort, { once: true });
  });
  options.signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(
    () =>
      controller.abort(
        new ApiError(
          "The API request timed out before its outcome was confirmed. Retry this action to recover its result.",
          408,
          undefined,
          true,
        ),
      ),
    timeoutMs,
  );
  if (options.signal?.aborted) cancel();
  try {
    return await Promise.race([
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return operation(controller.signal);
      }),
      aborted,
    ]);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
    controller.signal.removeEventListener("abort", rejectAbort);
    controller.abort();
  }
}

/** The generated client supplies wire types; this guard rejects the older API
 * whose policy/allocation semantics differ from the merged v0.3 contract. */
export function assertCompatibleConfig(
  config: components["schemas"]["Config"],
): void {
  const policy = config?.policy;
  const capabilities = config?.capabilities;
  const integerInRange = (value: number | undefined, maximum: number) =>
    Number.isInteger(value) && value! >= 0 && value! <= maximum;
  if (
    !config ||
    !["mock", "paypal_sandbox"].includes(config.mode) ||
    config.currency !== "USD" ||
    !config.terms_version ||
    config.terms_version !== policy?.terms_version ||
    policy?.participation_allocation_basis !== "qualified_agent" ||
    policy.participation_fee_bps !== 1000 ||
    policy.qualification_grace_seconds !== 120 ||
    !integerInRange(policy.commission_bps, 10000) ||
    !integerInRange(policy.expense_cap_minor, 1000000) ||
    !capabilities ||
    typeof capabilities.authorization !== "boolean" ||
    typeof capabilities.final_partial_capture !== "boolean" ||
    typeof capabilities.additional_checkout !== "boolean" ||
    typeof capabilities.external_agents !== "boolean" ||
    capabilities.blockchain !== false ||
    !["simulated", "disabled", "approved_provider"].includes(
      capabilities.payouts,
    ) ||
    !Number.isFinite(Date.parse(config.server_time))
  ) {
    throw new Error(
      "This API is incompatible with frontend contract v0.3.0. Restart the local mock from this checkout or connect a matching backend, then reconnect. Purchases are paused.",
    );
  }
}

export function unwrap<T>(result: {
  data?: T;
  error?: unknown;
  response: Response;
}): T {
  if (!result.response.ok || result.data === undefined) {
    const problem = result.error as Partial<Problem> | undefined;
    throw new ApiError(
      problem?.detail || `Request failed (${result.response.status}).`,
      result.response.status,
      problem?.code,
      problem?.retryable ?? result.response.status >= 500,
      problem?.request_id,
    );
  }
  return result.data;
}

export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
let namespace = "unconfigured";
export function setCommandNamespace(value: string) {
  namespace = value;
}
type Receipt = { key: string; body: string; confirmed: boolean };

// Browser recovery stores command identities, never a credential. A cryptographic
// namespace keeps separate accounts and API origins from sharing a command key.
export async function command<T>(
  scope: string,
  body: unknown,
  execute: (
    key: string,
    signal: AbortSignal,
  ) => Promise<{ data?: T; error?: unknown; response: Response }>,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  if (typeof window === "undefined")
    throw new Error("Buyer commands require a browser session.");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(namespace),
  );
  const prefix = Array.from(new Uint8Array(digest), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
  const storageKey = `provable.command.${prefix}.${scope}`;
  const serialized = JSON.stringify(body ?? null);
  let receipt: Receipt;
  try {
    const saved = localStorage.getItem(storageKey);
    receipt = saved
      ? (JSON.parse(saved) as Receipt)
      : { key: crypto.randomUUID(), body: serialized, confirmed: false };
    if (receipt.body !== serialized)
      throw new Error(
        "This action already has a saved request. Retry the original action before changing it.",
      );
    localStorage.setItem(storageKey, JSON.stringify(receipt));
  } catch (error) {
    if (error instanceof Error && error.message.includes("saved request"))
      throw error;
    throw new Error(
      "Enable browser storage to safely save this action before continuing.",
    );
  }
  try {
    const data = unwrap(
      await withRequestTimeout(
        (signal) => execute(receipt.key, signal),
        options,
      ),
    );
    localStorage.setItem(
      storageKey,
      JSON.stringify({ ...receipt, confirmed: true }),
    );
    return data;
  } catch (error) {
    // Preacceptance 4xx rejections create no command. Network/5xx/unknown outcomes
    // retain the exact original key and body, including after a page refresh.
    if (
      error instanceof ApiError &&
      error.status >= 400 &&
      error.status < 500 &&
      !error.retryable &&
      error.status !== 408 &&
      error.status !== 429
    )
      localStorage.removeItem(storageKey);
    throw error;
  }
}

export async function readGallery(api: Api, id: string, signal?: AbortSignal) {
  return (await readQualifiedGallery(api, id, { signal })).filter(
    (s) => s.qualification_status === "qualified",
  );
}

/** Only send buyer credentials to the configured API origin. Never follow a
 * credentialed redirect to a storage host or render agent-provided executable data. */
export function protectedUrl(value: string, baseUrl: string) {
  const base = new URL(baseUrl);
  const target = new URL(value, `${baseUrl.replace(/\/$/, "")}/`);
  if (
    target.origin !== base.origin ||
    !["http:", "https:"].includes(target.protocol) ||
    target.username ||
    target.password
  ) {
    throw new Error(
      "The API returned an unsupported asset host. Ask the operator to configure the authenticated asset gateway.",
    );
  }
  return target.href;
}

export async function fetchProtected(
  value: string,
  settings: { baseUrl: string; token: string },
  signal?: AbortSignal,
) {
  const response = await fetch(protectedUrl(value, settings.baseUrl), {
    headers: { Authorization: `Bearer ${settings.token}` },
    cache: "no-store",
    redirect: "error",
    signal,
  });
  if (!response.ok) {
    let problem: Partial<Problem> = {};
    try {
      problem = await response.json();
    } catch {
      /* Gateway may return an empty error. */
    }
    throw new ApiError(
      problem.detail ||
        (response.status === 410
          ? "This access link has expired. Request fresh access."
          : "This asset is locked or unavailable."),
      response.status,
      problem.code,
      problem.retryable ?? false,
      problem.request_id,
    );
  }
  return response;
}
