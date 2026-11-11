"use client";

import {
  Fragment,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createApiClient, type components } from "@provable/api-client";
import {
  assertCompatibleConfig,
  REQUEST_TIMEOUT_MS,
  setCommandNamespace,
  unwrap,
  withRequestTimeout,
} from "@/lib/api";

export type Settings = { baseUrl: string; token: string };
const defaultUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4010";
function defaults(): Settings {
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(
    new URL(defaultUrl).hostname,
  );
  void local;
  return { baseUrl: defaultUrl.replace(/\/$/, ""), token: "" };
}
const buyerKey = (baseUrl: string) => `provable.buyer.${baseUrl}`;
function validateSettings(next: Settings): Settings {
  const url = new URL(next.baseUrl);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Enter an HTTP or HTTPS API URL without credentials or a query string.",
    );
  const token = next.token.trim();
  if (token.startsWith("pba_") || token.startsWith("pbo_"))
    throw new Error("Use a buyer credential in the buyer application.");
  return { baseUrl: next.baseUrl.replace(/\/$/, ""), token };
}
type Context = {
  api: ReturnType<typeof createApiClient>;
  settings: Settings;
  config: components["schemas"]["Config"] | null;
  loading: boolean;
  error: string | null;
  updateSettings: (settings: Settings) => void;
  reconnect: () => void;
  requestTimeoutMs: number;
};
const ApiContext = createContext<Context | null>(null);

export function ApiProvider({
  children,
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
}: {
  children: ReactNode;
  requestTimeoutMs?: number;
}) {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<Context["config"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [connectionVersion, setConnectionVersion] = useState(0);
  useEffect(() => {
    let next = defaults();
    try {
      const stored = sessionStorage.getItem("provable.connection");
      if (stored) next = validateSettings(JSON.parse(stored) as Settings);
      if (!next.token) next.token = localStorage.getItem(buyerKey(next.baseUrl)) ?? "";
    } catch {
      /* A session without storage can browse; commands require storage. */
    }
    if (next.token) {
      setSettings(next);
      setReady(true);
      return;
    }
    // First visit: the API issues an anonymous buyer session. PayPal identifies the payer at checkout.
    fetch(`${next.baseUrl}/v1/buyer-sessions`, {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((session: { token: string }) => {
        try {
          localStorage.setItem(buyerKey(next.baseUrl), session.token);
        } catch {
          /* Without storage the session lasts for this page only. */
        }
        setSettings({ ...next, token: session.token });
      })
      .catch(() => setSettings(next))
      .finally(() => setReady(true));
  }, []);
  const api = useMemo(() => {
    setCommandNamespace(`${settings.baseUrl}\n${settings.token}`);
    return createApiClient({
      baseUrl: settings.baseUrl,
      token: settings.token || undefined,
    });
  }, [settings]);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setConfig(null);
    withRequestTimeout(
      (signal) => api.GET("/v1/config", { signal }).then(unwrap),
      { signal: controller.signal, timeoutMs: requestTimeoutMs },
    )
      .then((value) => {
        assertCompatibleConfig(value);
        if (!controller.signal.aborted) setConfig(value);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error
              ? err.message
              : "The API could not be reached.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, ready, revision, requestTimeoutMs]);
  function updateSettings(next: Settings) {
    const clean = validateSettings(next);
    sessionStorage.setItem("provable.connection", JSON.stringify(clean));
    setConfig(null);
    setError(null);
    setLoading(true);
    setSettings(clean);
    setConnectionVersion((value) => value + 1);
  }
  return (
    <ApiContext.Provider
      value={{
        api,
        settings,
        config,
        loading,
        error,
        updateSettings,
        reconnect: () => {
          setConfig(null);
          setError(null);
          setLoading(true);
          setRevision((n) => n + 1);
        },
        requestTimeoutMs,
      }}
    >
      {ready ? (
        <Fragment key={connectionVersion}>{children}</Fragment>
      ) : (
        <div className="page-shell loading-page" role="status">
          <span className="eyebrow">provable.bid</span>
          <h1>Opening your creative workspace.</h1>
        </div>
      )}
    </ApiContext.Provider>
  );
}
export function useApi() {
  const context = useContext(ApiContext);
  if (!context) throw new Error("Missing API provider.");
  return context;
}
