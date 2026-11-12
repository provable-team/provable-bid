"use client";

import { useEffect, useState } from "react";

export function paymentEnvironmentText(mode: string | null): string {
  if (mode === "paypal_sandbox") return "PayPal sandbox uses test accounts and test money; no real charges.";
  if (mode === "paypal_live") return "PayPal live uses real money and real payments.";
  if (mode === "mock") return "Local simulation uses fake payments; no real charges.";
  return "Payment environment is currently unavailable. Check the payment details before approving.";
}

export function PaymentEnvironmentNotice() {
  const [mode, setMode] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4010";
    void fetch(`${base.replace(/\/$/, "")}/v1/config`, { signal: controller.signal, cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((config) => setMode(typeof config?.mode === "string" ? config.mode : null))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return <span>{paymentEnvironmentText(mode)}</span>;
}
