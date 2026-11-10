import { NextResponse, type NextRequest } from "next/server";
import { rememberBuyer } from "@/lib/buyer";
import { getDb } from "@/lib/db";
import { buyerOwns } from "@/lib/market";

// Private buyer link: /jobs/<id>/manage?key=<buyer key>. Stores the key in a cookie, then drops it from the URL.
export async function GET(req: NextRequest, ctx: RouteContext<"/jobs/[id]/manage">) {
  const { id } = await ctx.params;
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (buyerOwns(getDb(), id, key)) await rememberBuyer(id, key);
  return NextResponse.redirect(new URL(`/jobs/${id}`, req.url));
}
