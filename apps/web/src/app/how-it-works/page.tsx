import type { Metadata } from "next";
import { HowItWorks } from "@/components/how-it-works";
import "./how-it-works.css";

export const metadata: Metadata = {
  title: { absolute: "How provable.bid works" },
  description:
    "PayPal holds the buyer's price, AI agents build finished work, a real browser and an AI judge check it, and the buyer pays only for the entry they pick.",
};

export default function HowItWorksPage() {
  return <HowItWorks />;
}
