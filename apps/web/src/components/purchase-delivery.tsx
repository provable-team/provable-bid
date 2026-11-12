"use client";

import { useEffect, useRef, useState } from "react";
import type { Purchase, operations } from "@provable/api-client";
import {
  ApiError,
  command,
  fetchProtected,
  protectedUrl,
  unwrap,
} from "@/lib/api";
import { useApi } from "./api-provider";
import { ReceiptDownload } from "./receipt-download";
import { Icon } from "./ui";

type DeliveryAccess =
  operations["createDeliveryAccess"]["responses"][201]["content"]["application/json"];
type DeliveryCursor = { generation: string; expiresAt: string | null };
type ReadyAccess = {
  data: DeliveryAccess;
  connection: string;
  purchaseId: string;
};

const formats: Record<
  DeliveryAccess["artifacts"][number]["mime_type"],
  { extension: string; label: string }
> = {
  "text/html": { extension: "html", label: "Website (single HTML file)" },
};

function assertBuyerDeliveryGateway(url: string) {
  // Originals come only from the buyer-bound delivery gateway.
  const path = new URL(url).pathname;
  if (!/\/v1\/deliveries\/[A-Za-z0-9_-]+$/.test(path)) {
    throw new Error("This URL is not an authorized buyer delivery gateway.");
  }
}

function freshCursor(): DeliveryCursor {
  return { generation: crypto.randomUUID(), expiresAt: null };
}

export function PurchaseDelivery({
  purchase,
  disabled = false,
  onRefresh,
}: {
  purchase: Purchase;
  disabled?: boolean;
  onRefresh?: () => void;
}) {
  const { api, settings } = useApi();
  const connection = `${settings.baseUrl}\n${settings.token}`;
  const currentContext = useRef({ connection, purchaseId: purchase.id });
  currentContext.current = { connection, purchaseId: purchase.id };
  const activeRequest = useRef<AbortController | null>(null);
  const running = useRef(false);
  const objectUrls = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [access, setAccess] = useState<ReadyAccess | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const available =
    purchase.delivery_unlocked && purchase.status === "payment_completed";
  const visibleAccess =
    access?.connection === connection &&
    access.purchaseId === purchase.id &&
    available
      ? access
      : null;

  useEffect(() => {
    setAccess(null);
    setMessage(null);
    setError(null);
    setBusy(false);
    running.current = false;
    return () => {
      activeRequest.current?.abort();
      activeRequest.current = null;
      for (const [url, timer] of objectUrls.current) {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
      }
      objectUrls.current.clear();
    };
  }, [connection, purchase.id]);

  useEffect(() => {
    if (!available) {
      activeRequest.current?.abort();
      setAccess(null);
    }
  }, [available]);

  function stillCurrent() {
    return (
      currentContext.current.connection === connection &&
      currentContext.current.purchaseId === purchase.id
    );
  }

  async function cursorKey() {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(connection),
    );
    const account = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    return `provable.delivery.${account}.${purchase.id}`;
  }

  function saveCursor(key: string, cursor: DeliveryCursor) {
    try {
      localStorage.setItem(key, JSON.stringify(cursor));
    } catch {
      throw new Error(
        "Enable browser storage to safely recover download access.",
      );
    }
  }

  function readCursor(key: string): DeliveryCursor {
    let value: string | null;
    try {
      value = localStorage.getItem(key);
    } catch {
      throw new Error(
        "Enable browser storage to safely recover download access.",
      );
    }
    if (!value) {
      const cursor = freshCursor();
      saveCursor(key, cursor);
      return cursor;
    }
    let saved: unknown;
    try {
      saved = JSON.parse(value);
    } catch {
      throw new Error(
        "Saved download access could not be recovered. Ask the operator to review this browser’s saved access request.",
      );
    }
    const cursor = saved as Partial<DeliveryCursor> | null;
    if (
      !cursor ||
      typeof cursor.generation !== "string" ||
      !/^[A-Za-z0-9_-]{8,128}$/.test(cursor.generation) ||
      !(
        cursor.expiresAt === null ||
        (typeof cursor.expiresAt === "string" &&
          Number.isFinite(Date.parse(cursor.expiresAt)))
      )
    ) {
      throw new Error(
        "Saved download access could not be recovered. Ask the operator to review this browser’s saved access request.",
      );
    }
    return cursor as DeliveryCursor;
  }

  async function getAccess(signal: AbortSignal): Promise<DeliveryAccess> {
    const latest = unwrap(
      await api.GET("/v1/purchases/{purchase_id}", {
        params: { path: { purchase_id: purchase.id } },
        signal,
      }),
    );
    if (!stillCurrent() || signal.aborted)
      throw new DOMException("Download request was cancelled.", "AbortError");
    if (!latest.delivery_unlocked || latest.status !== "payment_completed") {
      setAccess(null);
      onRefresh?.();
      throw new ApiError(
        "Originals are locked while payment is pending, failed, refunded, disputed, or held. Refresh the purchase to see its current status.",
        409,
        "DELIVERY_LOCKED",
        false,
      );
    }
    const checkedAt = Date.now();
    const serverNow = () =>
      Date.parse(latest.server_time) + Date.now() - checkedAt;
    if (
      visibleAccess &&
      Date.parse(visibleAccess.data.expires_at) > serverNow()
    )
      return visibleAccess.data;
    const key = await cursorKey();
    if (!stillCurrent() || signal.aborted)
      throw new DOMException("Download request was cancelled.", "AbortError");
    let cursor = readCursor(key);
    // A known expired issuance is a new, nonfinancial access request. A network
    // timeout leaves expiresAt null and reuses the exact prior logical key.
    for (let attempt = 0; attempt < 2; attempt++) {
      if (cursor.expiresAt && Date.parse(cursor.expiresAt) <= serverNow()) {
        cursor = freshCursor();
        saveCursor(key, cursor);
      }
      const data = await command(
        `delivery:${purchase.id}:${cursor.generation}`,
        null,
        (idempotencyKey) =>
          api.POST("/v1/purchases/{purchase_id}/delivery-access", {
            params: {
              path: { purchase_id: purchase.id },
              header: { "Idempotency-Key": idempotencyKey },
            },
            signal,
          }),
      );
      if (!stillCurrent() || signal.aborted)
        throw new DOMException("Download request was cancelled.", "AbortError");
      if (!Number.isFinite(Date.parse(data.expires_at)))
        throw new Error(
          "The API returned an invalid download expiry. Ask the operator to review delivery access.",
        );
      cursor = { ...cursor, expiresAt: data.expires_at };
      saveCursor(key, cursor);
      // A recovered receipt can contain already expired links. Record its known
      // expiry before requesting a new access grant; never repurchase or capture.
      if (Date.parse(data.expires_at) <= serverNow()) continue;
      setAccess({ data, connection, purchaseId: purchase.id });
      return data;
    }
    throw new Error(
      "This download access has expired. Try again to request fresh links; your purchase is unchanged.",
    );
  }

  async function act(assetId?: string) {
    if (!available || disabled || running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    const controller = new AbortController();
    activeRequest.current = controller;
    try {
      const data = await getAccess(controller.signal);
      if (!assetId) {
        // Do not offer links which the buyer application is not allowed to fetch.
        for (const artifact of data.artifacts) {
          assertBuyerDeliveryGateway(
            protectedUrl(artifact.url, settings.baseUrl),
          );
        }
        setMessage(
          "Download access is ready. Links last 60 seconds and renew without another purchase.",
        );
        return;
      }
      const artifact = data.artifacts.find((item) => item.asset_id === assetId);
      if (!artifact)
        throw new Error(
          "This artifact is no longer included in the purchase’s delivery access. Refresh the purchase.",
        );
      if (!Object.hasOwn(formats, artifact.mime_type))
        throw new Error("This original has an unsupported file format.");
      const format = formats[artifact.mime_type];
      const url = protectedUrl(artifact.url, settings.baseUrl);
      assertBuyerDeliveryGateway(url);
      const response = await fetchProtected(url, settings, controller.signal);
      const mime = response.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase();
      if (mime !== artifact.mime_type)
        throw new Error(
          "This download’s file format does not match the purchased artifact.",
        );
      const blob = await response.blob();
      if (controller.signal.aborted || !stillCurrent()) return;
      if (blob.size !== artifact.size_bytes)
        throw new Error(
          "The original download is incomplete. Retry this file.",
        );
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${purchase.id}-${artifact.asset_id}.${format.extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      const timer = setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        objectUrls.current.delete(objectUrl);
      }, 1000);
      objectUrls.current.set(objectUrl, timer);
      setMessage(`${format.label} download started.`);
    } catch (cause) {
      if (!controller.signal.aborted && stillCurrent()) {
        setError(
          cause instanceof Error
            ? cause.message
            : "This original is unavailable. Try requesting fresh access.",
        );
        if (
          cause instanceof ApiError &&
          (cause.code === "DELIVERY_LOCKED" || cause.status === 410)
        ) {
          setAccess(null);
          onRefresh?.();
        }
      }
    } finally {
      if (stillCurrent()) {
        running.current = false;
        setBusy(false);
      }
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }

  if (!available)
    return (
      <div className="purchase-delivery delivery-note">
        <Icon name="lock" size={15} />
        <span>
          Originals stay locked until the API confirms payment and delivery
          access.
        </span>
      </div>
    );

  return (
    <div className="purchase-delivery">
      <button
        type="button"
        className="button secondary small"
        disabled={disabled || busy}
        onClick={() => void act()}
      >
        <Icon name="download" size={16} />
        {busy
          ? "Checking delivery…"
          : visibleAccess
            ? "Refresh download access"
            : "Get originals"}
      </button>
      {visibleAccess && !error && (
        <div className="delivery-list">
          {visibleAccess.data.artifacts.map((artifact, index) => (
            <button
              key={artifact.asset_id}
              type="button"
              className="button secondary small delivery-artifact"
              disabled={disabled || busy}
              onClick={() => void act(artifact.asset_id)}
            >
              <Icon name="download" size={14} />
              {formats[artifact.mime_type]?.label ?? "Original file"}{" "}
              {index + 1}
              <span className="muted">
                {Math.ceil(artifact.size_bytes / 1024)} KB
              </span>
            </button>
          ))}
        </div>
      )}
      {message && (
        <p className="delivery-note" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="delivery-note error-message" role="alert">
          {error}
        </p>
      )}
      <ReceiptDownload purchaseId={purchase.id} disabled={disabled} />
    </div>
  );
}
