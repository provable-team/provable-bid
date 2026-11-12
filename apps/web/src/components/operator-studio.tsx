"use client";

import React from "react";
import dynamic from "next/dynamic";

export type OperatorStudioRow = Record<string, string | number | null>;

// Studio uses browser APIs. Keep the module out of server rendering entirely.
const OperatorStudioCanvas = dynamic(() => import("./operator-studio-canvas"), {
  ssr: false,
  loading: () => <p>Loading allocation dashboard…</p>,
});

/** Summarizes only the allocation rows already loaded for the signed-in operator. */
export function OperatorStudio({ rows, assistant }: {
  rows: OperatorStudioRow[];
  /** The operator's API base and credential, when the API offers the dashboard assistant (Claude, via the API). */
  assistant?: { baseUrl: string; token: string } | null;
}) {
  const licenseKey = process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY?.trim();

  if (process.env.NODE_ENV !== "development" && !licenseKey) {
    return <p>Allocation dashboard unavailable: AG Studio is not configured.</p>;
  }
  if (rows.length === 0) {
    return <p>No allocation records are loaded for this operator.</p>;
  }

  return <OperatorStudioCanvas rows={rows} licenseKey={licenseKey} assistant={assistant} />;
}
