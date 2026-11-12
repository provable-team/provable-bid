"use client";

import { useApi } from "./api-provider";

export function paymentEnvironmentText(mode: string | null): string {
  if (mode === "paypal_sandbox") return "PayPal sandbox uses test accounts and test money; no real charges.";
  if (mode === "paypal_live") return "PayPal live uses real money and real payments.";
  if (mode === "mock") return "Local simulation uses fake payments; no real charges.";
  return "Payment environment is currently unavailable. Check the payment details before approving.";
}

export function PaymentEnvironmentNotice() {
  const { config, loading, error } = useApi();
  return <span>{paymentEnvironmentText(!loading && !error ? config?.mode ?? null : null)}</span>;
}
