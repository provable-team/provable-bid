// Seeds demo data with REAL PayPal sandbox escrow captures (card-funded, so no browser is needed).
//   npm run db:seed               # add demo jobs + the demo agent
//   npm run db:seed -- --reset    # wipe the local DB first
//   npm run db:seed -- --if-empty # only seed a fresh DB (Render's disk is ephemeral)
import fs from "node:fs";
import path from "node:path";
import { CheckoutPaymentIntent } from "@paypal/paypal-server-sdk";
import { getDb, t } from "@/lib/db";
import { escrowLineItems, fundJobFromOrder } from "@/lib/escrow";
import { createJob, getJob, registerAgent, upsertOperator } from "@/lib/market";
import { buildOrderRequest, describePayPalError, ordersController } from "@/lib/paypal/orders";

const DB_FILE = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "provable.db");

export const DEMO_JOBS = [
  {
    title: "Landing page for a neighborhood bakery",
    brief: "Single page for Crumb & Co., a family bakery. Warm, handmade feel. Hero with today's bakes, a short story section, opening hours, and a pre-order button. Mobile first.",
    budgetCents: 300_00,
    buyerName: "Bea Lindqvist",
  },
  {
    title: "Pricing page for a B2B analytics SaaS",
    brief: "Three tiers (Starter, Team, Enterprise), monthly/annual toggle, a feature comparison table and an FAQ. Clean, confident, lots of whitespace. Brand color is deep teal.",
    budgetCents: 450_00,
    buyerName: "Marcus Oyelaran",
  },
  {
    title: "Portfolio site for a wedding photographer",
    brief: "Moody, editorial look. Full-bleed gallery grid, a short about section, packages, and a contact form. Serif headings. Should feel like a printed magazine.",
    budgetCents: 220_00,
    buyerName: "Priya Raman",
  },
];

const CARD = { number: "4032039317984658", expiry: "2030-12", securityCode: "123" };

async function fundWithCard(jobId: string, buyerName: string) {
  const job = getJob(getDb(), jobId)!;
  const body = buildOrderRequest(escrowLineItems(job));
  body.intent = CheckoutPaymentIntent.Capture;
  body.purchaseUnits[0].customId = job.id;
  body.paymentSource = { card: { ...CARD, name: buyerName } };
  const { result } = await ordersController().createOrder({ body, paypalRequestId: crypto.randomUUID(), prefer: "return=representation" });
  const r = fundJobFromOrder(getDb(), jobId, result);
  if (!r.ok) throw new Error(r.error);
  return r.data.captureId;
}

async function main() {
  if (process.argv.includes("--reset")) {
    for (const f of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) fs.rmSync(f, { force: true });
    console.log("Reset", DB_FILE);
  }
  const db = getDb();
  if (process.argv.includes("--if-empty") && db.select({ id: t.jobs.id }).from(t.jobs).limit(1).get()) {
    console.log("Database already has jobs; skipping seed.");
    return;
  }

  // The demo agent's operator: a sandbox PayPal account that went through "Connect with PayPal" once.
  // Its payer ID is kept in env so Render (ephemeral disk) recreates the same operator on every boot.
  const payerId = process.env.DEMO_OPERATOR_PAYER_ID;
  if (!payerId) console.log("DEMO_OPERATOR_PAYER_ID not set: skipping the demo agent.");
  else if (!db.select().from(t.agents).all().some((a) => a.handle === "pixel-forge")) {
    const op = upsertOperator(db, { paypalPayerId: payerId, paypalEmail: process.env.DEMO_OPERATOR_EMAIL || null, name: "Pixel Forge Labs" });
    const r = registerAgent(db, op.id, {
      handle: "pixel-forge",
      name: "Pixel Forge",
      bio: "Example agent from examples/agent.ts. Ships clean, mobile-first pages.",
    }, process.env.DEMO_AGENT_TOKEN || undefined);
    if (r.ok) console.log(`Registered demo agent @pixel-forge${process.env.DEMO_AGENT_TOKEN ? " (token from DEMO_AGENT_TOKEN)" : `. Token (shown once): ${r.data.token}`}`);
  }

  for (const j of DEMO_JOBS) {
    const created = createJob(db, { ...j, buyerEmail: `${j.buyerName.split(" ")[0].toLowerCase()}@example.com`, biddingHours: 72 });
    if (!created.ok) throw new Error(created.error);
    try {
      const captureId = await fundWithCard(created.data.jobId, j.buyerName);
      console.log(`✓ ${created.data.jobId} funded $${j.budgetCents / 100} + processing (capture ${captureId}) · manage key ${created.data.buyerKey}`);
    } catch (err) {
      console.error(`✗ ${created.data.jobId} not funded: ${describePayPalError(err)}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
