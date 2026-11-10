"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isBuyer, rememberBuyer } from "@/lib/buyer";
import { getDb } from "@/lib/db";
import { escrowLineItem, fundJobFromOrder } from "@/lib/escrow";
import { attachOrder, createJob, getJob, type Result } from "@/lib/market";
import { toCents } from "@/lib/money";
import { capturePayPalOrder, createPayPalOrder, describePayPalError } from "@/lib/paypal/orders";
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
    const id = await createPayPalOrder([escrowLineItem(job)], job.id);
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
    const order = await capturePayPalOrder(orderId);
    const r = fundJobFromOrder(getDb(), jobId, order);
    if (r.ok) refresh();
    return r;
  } catch (err) {
    console.error("[paypal] captureEscrow failed:", err);
    return { ok: false, error: describePayPalError(err) };
  }
}
