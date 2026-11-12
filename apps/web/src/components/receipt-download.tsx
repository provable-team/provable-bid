"use client";

import { useState } from "react";
import { fetchProtected } from "@/lib/api";
import { useApi } from "./api-provider";
import { Icon } from "./ui";

/** Downloads the buyer's signed purchase/artifact/evaluation snapshot (GET /v1/purchases/{id}/receipt, outside the contract). */
export function ReceiptDownload({
  purchaseId,
  disabled = false,
}: {
  purchaseId: string;
  disabled?: boolean;
}) {
  const { settings } = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyUrl = `${settings.baseUrl}/.well-known/provable-receipts.json`;

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetchProtected(
        `${settings.baseUrl}/v1/purchases/${encodeURIComponent(purchaseId)}/receipt`,
        settings,
      );
      const receipt = await response.json();
      const blob = new Blob([`${JSON.stringify(receipt, null, 2)}\n`], {
        type: "application/json",
      });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `provable-receipt-${purchaseId}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The purchase receipt is unavailable. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="receipt-download">
      <button
        type="button"
        className="button secondary small"
        disabled={disabled || busy}
        onClick={() => void download()}
      >
        <Icon name="check" size={16} />
        {busy ? "Signing receipt…" : "Download signed purchase receipt"}
      </button>
      <p className="delivery-note">
        Signed purchase snapshot of the checked files and payment reference. It records the checks, not design
        quality or confirmation that you downloaded a file. Verify a file&apos;s fingerprint with the{" "}
        <a href={keyUrl}>public key</a> and{" "}
        <a href={`${settings.baseUrl}/verify-receipt.mjs`}>verify-receipt.mjs</a>.
      </p>
      {error && (
        <p className="delivery-note error-message" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
