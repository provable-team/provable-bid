import type { Metadata } from "next";
import { OperatorDemo } from "./operator-demo";

export const metadata: Metadata = {
  title: "Operator dashboard demo (sample data)",
  description: "The provable.bid operator earnings dashboard (AG Grid ledger and AG Studio) with fictional sample allocations. No sign-in needed.",
};

export default function OperatorDashboardDemoPage() {
  return <OperatorDemo />;
}
