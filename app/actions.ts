"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isBuyer, rememberBuyer } from "@/lib/buyer";
import { getDb } from "@/lib/db";
import { escrowLineItems, fundJobFromOrder, payerProblem } from "@/lib/escrow";
import { acceptDelivery, attachOrder, awardBid, cancelJob, createJob, getJob, requestRevision, settleJob, type Result } from "@/lib/market";
import { formatMoney, toCents } from "@/lib/money";
import { capturePayPalOrder, createPayPalOrder, describePayPalError, getPayPalOrder } from "@/lib/paypal/orders";
import { paypalRail } from "@/lib/paypal/rail";
import { BIDDING_HOURS, MAX_BUDGET_CENTS, MIN_BUDGET_CENTS } from "@/lib/rules";

// Server Actions are public HTTP endpoints: validate every input and check the buyer key.

const jobIdSchema = z.string().regex(/^j_[a-z0-9]{10}$/);

const PostJob = z.object({
  title: z.string().trim().min(8, "Give the job a title of at least 8 characters.").max(120),
  brief: z.string().trim().min(40, "Describe the page in at least 40 characters, so agents can make a useful sample.").max(4000),
  budget: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter the budget in dollars, like 300 or 249.50.")
    .transform(toCents)
    .refine((c) => c >= MIN_BUDGET_CENTS && c <= MAX_BUDGET_CENTS, `Budget must be between $${MIN_BUDGET_CENTS / 100} and $${MAX_BUDGET_CENTS / 100}.`),
  biddingHours: z.coerce.number().pipe(z.union(BIDDING_HOURS.map((h) => z.literal(h)) as [z.ZodLiteral<24>, z.ZodLiteral<72>, z.ZodLiteral<168>])),
  buyerName: z.string().trim().min(2, "Enter your name.").max(80),
  buyerEmail: z.email("Enter a valid email.").max(200),
});

export type PostJobState = { error?: string; fields?: Record<string, string> };

export async function postJob(_prev: PostJobState, form: FormData): Promise<PostJobState> {
  const fields = Object.fromEntries(["title", "brief", "budget", "biddingHours", "buyerName", "buyerEmail"].map((k) => [k, String(form.get(k) ?? "")]));
  const parsed = PostJob.safeParse(fields);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const { budget, ...rest } = parsed.data;
  const r = createJob(getDb(), { ...rest, budgetCents: budget });
  if (!r.ok) return { error: r.error, fields };
  await rememberBuyer(r.data.jobId, r.data.buyerKey);
  redirect(`/jobs/${r.data.jobId}`);
}

export async function createEscrowOrder(jobId: string): Promise<Result<{ id: string }>> {
  if (!jobIdSchema.safeParse(jobId).success || !(await isBuyer(jobId))) return { ok: false, error: "Only this job's buyer can fund it." };
  const job = getJob(getDb(), jobId)!;
  if (job.status !== "awaiting_payment") return { ok: false, error: "This job is already funded." };
  try {
    const id = await createPayPalOrder(escrowLineItems(job), job.id);
    attachOrder(getDb(), jobId, id);
    return { ok: true, data: { id } };
  } catch (err) {
    console.error("[paypal] createEscrowOrder failed:", err);
    return { ok: false, error: describePayPalError(err) };
  }
}

export async function captureEscrow(jobId: string, orderId: string): Promise<Result<{ captureId: string }>> {
  if (!jobIdSchema.safeParse(jobId).success || !z.string().regex(/^[A-Z0-9]{10,40}$/).safeParse(orderId).success)
    return { ok: false, error: "Invalid request." };
  if (!(await isBuyer(jobId))) return { ok: false, error: "Only this job's buyer can fund it." };
  const job = getJob(getDb(), jobId)!;
  if (job.captureId) return { ok: true, data: { captureId: job.captureId } }; // already funded (double submit)
  if (job.paypalOrderId !== orderId) return { ok: false, error: "That PayPal order isn't for this job." };
  try {
    const problem = payerProblem(await getPayPalOrder(orderId));
    if (problem) return { ok: false, error: problem }; // approved but not captured: no money moves
    const order = await capturePayPalOrder(orderId);
    const r = fundJobFromOrder(getDb(), jobId, order);
    if (r.ok) refresh();
    return r;
  } catch (err) {
    console.error("[paypal] captureEscrow failed:", err);
    return { ok: false, error: describePayPalError(err) };
  }
}

// ---------------------------------------------------------------- buyer decisions after funding
// Each returns a friendly message; a PayPal failure leaves a retryable row that syncPayments() retries.

const bidIdSchema = z.string().regex(/^b_[a-z0-9]{10}$/);
const notBuyer = { ok: false as const, error: "Only this job's buyer can do that." };

async function asBuyer(jobId: string) {
  return jobIdSchema.safeParse(jobId).success && (await isBuyer(jobId));
}

function moneyNote(p: { status: string; error: string | null } | null, what: string) {
  if (!p) return "";
  if (p.status === "pending") return ` PayPal didn't take the ${what} yet (${p.error}); it will retry.`;
  return "";
}

export async function awardJob(jobId: string, bidId: string): Promise<Result<{ message: string }>> {
  if (!(await asBuyer(jobId)) || !bidIdSchema.safeParse(bidId).success) return notBuyer;
  const r = await awardBid(getDb(), paypalRail, jobId, bidId);
  if (!r.ok) return r;
  refresh();
  const back = r.data.refundToBuyerCents;
  return { ok: true, data: { message: (back > 0 ? `Awarded. ${formatMoney(back)} is on its way back to you.` : "Awarded.") + moneyNote(r.data.refund, "refund") } };
}

export async function askForRevision(jobId: string, request: string): Promise<Result<{ message: string }>> {
  if (!(await asBuyer(jobId))) return notBuyer;
  const text = z.string().trim().min(10, "Say what should change (10+ characters).").max(2000).safeParse(request);
  if (!text.success) return { ok: false, error: text.error.issues[0].message };
  const r = requestRevision(getDb(), jobId, text.data);
  if (!r.ok) return r;
  refresh();
  return { ok: true, data: { message: "Revision requested. The agent has a fresh delivery window." } };
}

export async function acceptJob(jobId: string): Promise<Result<{ message: string }>> {
  if (!(await asBuyer(jobId))) return notBuyer;
  const r = await acceptDelivery(getDb(), paypalRail, jobId);
  if (!r.ok) return r;
  refresh();
  return { ok: true, data: { message: `Accepted. ${formatMoney(r.data.payoutToAgentCents)} is being paid to the agent.` + moneyNote(r.data.payout, "payout") } };
}

export async function cancelOrder(jobId: string): Promise<Result<{ message: string }>> {
  if (!(await asBuyer(jobId))) return notBuyer;
  const r = await cancelJob(getDb(), paypalRail, jobId);
  if (!r.ok) return r;
  refresh();
  return { ok: true, data: { message: (r.data.refundCents > 0 ? `Cancelled. ${formatMoney(r.data.refundCents)} is on its way back to you.` : "Cancelled.") + moneyNote(r.data.refund, "refund") } };
}

// Called by the ledger while money is moving: retries unsent rows and picks up PayPal's latest status.
export async function syncPayments(jobId: string): Promise<Result<{ settled: boolean }>> {
  if (!(await asBuyer(jobId))) return notBuyer;
  const rows = await settleJob(getDb(), paypalRail, jobId);
  refresh();
  return { ok: true, data: { settled: rows.every((p) => p.status === "succeeded" || p.status === "failed") } };
}
