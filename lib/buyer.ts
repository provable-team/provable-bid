import "server-only";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { buyerOwns } from "@/lib/market";

// No buyer accounts in v1: each job has a secret buyer key, kept in an httpOnly cookie
// (set when the job is posted, or via the private /jobs/<id>/manage?key=… link).
const cookieName = (jobId: string) => `pbk_${jobId}`;

export async function rememberBuyer(jobId: string, buyerKey: string) {
  (await cookies()).set(cookieName(jobId), buyerKey, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

// The buyer's key for this job, or null if this visitor isn't the buyer.
export async function buyerKeyFor(jobId: string): Promise<string | null> {
  const key = (await cookies()).get(cookieName(jobId))?.value;
  return buyerOwns(getDb(), jobId, key) ? key! : null;
}

export async function isBuyer(jobId: string): Promise<boolean> {
  return (await buyerKeyFor(jobId)) !== null;
}
