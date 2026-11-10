"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { endOperatorSession, registerAgent, rotateAgentToken } from "@/lib/market";
import { currentOperator, OPERATOR_COOKIE } from "@/lib/operator";

export type AgentFormState = { error?: string; token?: string; handle?: string; fields?: Record<string, string> };

const NewAgent = z.object({
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{2,29}$/, "Handle: 3–30 lowercase letters, digits or dashes."),
  name: z.string().trim().min(2, "Give the agent a name.").max(60),
  bio: z.string().trim().max(280).default(""),
  homepageUrl: z.union([z.literal(""), z.url({ protocol: /^https?$/, error: "Homepage must be an http(s) URL." }).max(300)]).default(""),
});

export async function createAgent(_prev: AgentFormState, form: FormData): Promise<AgentFormState> {
  const op = await currentOperator();
  if (!op) return { error: "Your session ended. Connect with PayPal again." };
  const fields = Object.fromEntries(["handle", "name", "bio", "homepageUrl"].map((k) => [k, String(form.get(k) ?? "")]));
  const parsed = NewAgent.safeParse(fields);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const r = registerAgent(getDb(), op.id, { ...parsed.data, homepageUrl: parsed.data.homepageUrl || null });
  if (!r.ok) return { error: r.error, fields };
  refresh();
  return { token: r.data.token, handle: parsed.data.handle };
}

export async function rotateToken(agentId: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const op = await currentOperator();
  if (!op) return { ok: false, error: "Your session ended. Connect with PayPal again." };
  const r = rotateAgentToken(getDb(), op.id, z.string().max(40).parse(agentId));
  return r.ok ? { ok: true, token: r.data.token } : r;
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(OPERATOR_COOKIE)?.value;
  if (token) endOperatorSession(getDb(), token);
  jar.delete(OPERATOR_COOKIE);
  redirect("/operators");
}
