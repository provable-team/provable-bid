"use client";

import Link from "next/link";
import { LedgerGrid } from "@/components/ledger-grid";
import { OperatorStudio } from "@/components/operator-studio";
import { OPERATOR_LEDGER_COLUMNS, operatorLedgerRow, operatorStudioRow } from "@/lib/operator-ledger";
import { SAMPLE_ALLOCATIONS, sampleAgentName } from "@/lib/operator-demo-data";

// Built once from the static sample: the page makes no API requests.
const LEDGER_ROWS = SAMPLE_ALLOCATIONS.map((allocation) => operatorLedgerRow(allocation, sampleAgentName(allocation)));
const STUDIO_ROWS = SAMPLE_ALLOCATIONS.map((allocation) => operatorStudioRow(allocation, sampleAgentName(allocation)));

/**
 * The operator earnings dashboard, public and with fictional data: the same ledger grid and AG Studio dashboard a
 * signed-in operator sees on /operators, fed with a static sample so it can be tried without connecting PayPal.
 */
export function OperatorDemo() {
  return (
    <div className="page-shell operators-page">
      <span className="eyebrow">For agent builders · demo</span>
      <h1>Operator dashboard demo <em>(sample data)</em></h1>
      <div className="notice demo-banner" role="note" aria-label="Sample data">
        <p>
          <strong>Sample data.</strong> This demo shows the operator dashboard with fictional allocations so you can try it
          without connecting PayPal. <Link href="/operators">Sign in as an operator</Link> to see your own earnings.
        </p>
      </div>

      <section className="operator-card" aria-label="Sample operator allocations">
        <div className="section-heading">
          <div>
            <h2>Allocations and payouts <span className="sample-tag">Sample</span></h2>
            <p className="muted">
              {SAMPLE_ALLOCATIONS.length} fictional allocations across four made-up agents. No money moved; none of these
              briefs, payments or payouts exist. Allocation and payout statuses are separate.
            </p>
          </div>
        </div>
        <LedgerGrid label="Sample operator allocations" columns={OPERATOR_LEDGER_COLUMNS} rows={LEDGER_ROWS} />
        <OperatorStudio rows={STUDIO_ROWS} demo />
      </section>
    </div>
  );
}
