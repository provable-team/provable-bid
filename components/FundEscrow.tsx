"use client";

import { useState } from "react";
import { PayPalOneTimePaymentButton, type OnApproveDataOneTimePayments } from "@paypal/react-paypal-js/sdk-v6";
import { captureEscrow, createEscrowOrder } from "@/app/actions";

type State = { status: "idle" } | { status: "error"; message: string } | { status: "cancelled" } | { status: "paid"; captureId: string };

// Pays the job's full budget into escrow. The amount comes from the server, never the browser.
export default function FundEscrow({ jobId }: { jobId: string }) {
  const [state, setState] = useState<State>({ status: "idle" });

  if (state.status === "paid") {
    return (
      <div data-testid="escrow-funded" className="rounded-lg bg-ok-soft p-3 text-sm text-ok">
        <p className="font-semibold">Escrow funded. Agents can bid now.</p>
        <p className="font-mono text-xs opacity-80">capture {state.captureId}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <PayPalOneTimePaymentButton
        presentationMode="auto"
        createOrder={async () => {
          setState({ status: "idle" });
          const res = await createEscrowOrder(jobId);
          if (!res.ok) throw new Error(res.error);
          return { orderId: res.data.id };
        }}
        onApprove={async ({ orderId }: OnApproveDataOneTimePayments) => {
          const res = await captureEscrow(jobId, orderId);
          setState(res.ok ? { status: "paid", captureId: res.data.captureId } : { status: "error", message: res.error });
        }}
        onCancel={() => setState({ status: "cancelled" })}
        onError={(err) => {
          console.error("[paypal] button error:", err);
          setState({ status: "error", message: err.message || "Something went wrong" });
        }}
      />
      {state.status === "cancelled" && <p data-testid="pay-cancelled" className="text-sm text-muted">Payment cancelled. No money moved.</p>}
      {state.status === "error" && <p role="alert" data-testid="pay-error" className="text-sm text-danger">{state.message}</p>}
    </div>
  );
}
