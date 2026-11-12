"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type {
  Agent,
  Competition,
  Purchase,
  Submission,
} from "@provable/api-client";
import { useApi } from "@/components/api-provider";
import { AssetPreview } from "@/components/asset-preview";
import { AgentAvatar, Countdown } from "@/components/ui";
import {
  ApiError,
  money,
  readGallery,
  unwrap,
  withRequestTimeout,
} from "@/lib/api";
import styles from "./marketplace.module.css";

export type CompetitionEntry = {
  competition: Competition;
  owned: boolean;
  submissions: Submission[];
  purchases: Purchase[];
};

export function useCompetitionFeed() {
  const {
    api,
    config,
    loading: connecting,
    error: connectionError,
    reconnect,
    requestTimeoutMs,
  } = useApi();
  const [entries, setEntries] = useState<CompetitionEntry[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => {
    if (!config) reconnect();
    else setRevision((value) => value + 1);
  }, [config, reconnect]);

  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    setEntries([]);
    setAgents([]);
    setLoading(true);
    if (!config) {
      setLoading(false);
      return () => controller.abort();
    }

    async function load() {
      if (running) return;
      running = true;
      try {
        await withRequestTimeout(
          async (signal) => {
            const competitions: Competition[] = [];
            const registry: Agent[] = [];
            const reads = await Promise.allSettled([
              (async () => {
                let cursor: string | undefined;
                const seen = new Set<string>();
                do {
                  const page = unwrap(
                    await api.GET("/v1/competitions", {
                      params: {
                        query: { limit: 100, ...(cursor ? { cursor } : {}) },
                      },
                      signal,
                    }),
                  );
                  competitions.push(...page.items);
                  cursor = page.next_cursor ?? undefined;
                  if (cursor && seen.has(cursor))
                    throw new Error(
                      "Competition pagination repeated a cursor.",
                    );
                  if (cursor) seen.add(cursor);
                } while (cursor);
              })(),
              (async () => {
                let cursor: string | undefined;
                const seen = new Set<string>();
                do {
                  const page = unwrap(
                    await api.GET("/v1/agents", {
                      params: {
                        query: { limit: 100, ...(cursor ? { cursor } : {}) },
                      },
                      signal,
                    }),
                  );
                  registry.push(...page.items);
                  cursor = page.next_cursor ?? undefined;
                  if (cursor && seen.has(cursor))
                    throw new Error("Agent pagination repeated a cursor.");
                  if (cursor) seen.add(cursor);
                } while (cursor);
              })(),
            ]);
            // Agent discovery is public. An unauthenticated buyer-list request must
            // not discard a successfully loaded registry or its creative identities.
            if (!signal.aborted && reads[1].status === "fulfilled")
              setAgents(registry);
            if (reads[0].status === "rejected") throw reads[0].reason;
            const registryFailure: unknown =
              reads[1].status === "rejected" ? reads[1].reason : null;
            const loaded = await Promise.all(
              competitions.map(
                async (competition): Promise<CompetitionEntry> => {
                  const purchases: Purchase[] = [];
                  let cursor: string | undefined;
                  const seen = new Set<string>();
                  do {
                    const result = await api.GET(
                      "/v1/competitions/{competition_id}/purchases",
                      {
                        params: {
                          path: { competition_id: competition.id },
                          query: { limit: 100, ...(cursor ? { cursor } : {}) },
                        },
                        signal,
                      },
                    );
                    // Published briefs are discoverable; private work and receipts remain owner-only.
                    if (result.response.status === 404) {
                      return {
                        competition,
                        owned: false,
                        submissions: [],
                        purchases: [],
                      };
                    }
                    const page = unwrap(result);
                    purchases.push(...page.items);
                    cursor = page.next_cursor ?? undefined;
                    if (cursor && seen.has(cursor))
                      throw new Error("Purchase pagination repeated a cursor.");
                    if (cursor) seen.add(cursor);
                  } while (cursor);
                  const submissions = await readGallery(
                    api,
                    competition.id,
                    signal,
                  );
                  return { competition, owned: true, submissions, purchases };
                },
              ),
            );
            if (!signal.aborted) {
              setEntries(loaded.reverse());
              setError(
                registryFailure instanceof Error
                  ? registryFailure.message
                  : registryFailure
                    ? "The agent registry could not be loaded."
                    : null,
              );
            }
          },
          { signal: controller.signal, timeoutMs: requestTimeoutMs },
        );
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(
            failure instanceof ApiError && failure.status === 401
              ? "Connect a buyer credential to view competitions and your workspace. You can still explore public agent profiles."
              : failure instanceof Error
                ? failure.message
                : "The marketplace could not be loaded.",
          );
      } finally {
        running = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    const interval = window.setInterval(() => void load(), 10_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [api, revision, config, requestTimeoutMs]);

  return {
    entries,
    agents,
    config,
    loading: connecting || loading,
    error: connectionError || error,
    refresh,
  };
}

export function CompetitionCard({
  entry,
  agents,
}: {
  entry: CompetitionEntry;
  agents: Agent[];
}) {
  const { competition, submissions, purchases, owned } = entry;
  const submission = submissions.find((item) =>
    item.artifacts.some((artifact) => artifact.type === "html"),
  );
  const image = submission?.artifacts.find(
    (artifact) => artifact.type === "html",
  );
  const agent = agents.find((item) => item.id === submission?.agent_id);
  const delivered = purchases.filter((purchase) => purchase.delivery_unlocked);
  return (
    <article className={styles.competitionCard}>
      <Link
        href={`/competitions/${competition.id}`}
        className={styles.previewLink}
        aria-label={`View ${competition.title}`}
      >
        {image ? (
          <AssetPreview
            artifact={image}
            alt={`${agent?.name ?? "Qualified agent"}: ${submission?.title}`}
            className={styles.cardPreview}
          />
        ) : (
          <div
            className={`${styles.briefCover} ${competition.state === "draft" ? styles.draftCover : ""}`}
          >
            <span className={styles.coverKicker}>
              {competition.state === "draft"
                ? "YOUR NEXT BRIEF"
                : "THE CREATIVE BRIEF"}
            </span>
            <span className={styles.coverTitle}>{competition.title}</span>
            <span className={styles.coverCaption}>
              {owned
                ? "Finished work, different perspectives."
                : "Discover the brief. Private work stays private."}
            </span>
            <span className={styles.coverMark} aria-hidden="true">
              ↗
            </span>
          </div>
        )}
        <span className={styles.stateBadge}>
          {competition.state.replaceAll("_", " ")}
        </span>
        {image && (
          <span className={styles.previewCaption}>
            Qualified preview · {agent?.name ?? "Registered agent"}
          </span>
        )}
      </Link>
      <div className={styles.cardBody}>
        <div className={styles.cardTitleRow}>
          <h3>
            <Link href={`/competitions/${competition.id}`}>
              {competition.title}
            </Link>
          </h3>
          <strong>{money(competition.bid.amount_minor)}</strong>
        </div>
        <p className={styles.cardBrief}>{competition.brief}</p>
        <div className={styles.cardMeta}>
          {owned ? (
            <span>
              {submissions.length} qualified{" "}
              {submissions.length === 1 ? "entry" : "entries"}
              {delivered.length > 0 ? ` · ${delivered.length} unlocked` : ""}
            </span>
          ) : (
            <span>Published competition</span>
          )}
          <span>per selected entry</span>
        </div>
        <div className={styles.cardFooter}>
          <Countdown
            deadline={
              competition.state === "open"
                ? competition.submission_deadline
                : competition.decision_deadline
            }
            serverTime={competition.server_time}
            label={competition.state === "open" ? "Submissions" : "Decision"}
          />
          <Link
            href={`/competitions/${competition.id}`}
            className={styles.textLink}
          >
            {competition.state === "draft" ? "Finish setup" : "View brief"}{" "}
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </article>
  );
}

export function AgentCards({ agents }: { agents: Agent[] }) {
  return (
    <div className={styles.agentGrid}>
      {agents.map((agent, index) => (
        <article className={styles.agentCard} key={agent.id}>
          <div className={styles.agentTop}>
            <span className={styles.agentNumber}>0{index + 1}</span>
            <span className={styles.agentAvailability}>
              <i
                style={{
                  background:
                    agent.status === "available" ? "#6f8526" : "#8a8a80",
                }}
              />
              {agent.status}
            </span>
          </div>
          <AgentAvatar agent={agent} size={56} />
          <h3>{agent.name}</h3>
          <p>{agent.description}</p>
          <div className={styles.agentStyle}>{agent.style}</div>
          <div className={styles.agentBottom}>
            <span>{agent.capabilities.join(" + ")}</span>
            <span>
              {agent.internal
                ? `By ${agent.operator_name}`
                : "Outside agent"}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

export { styles as marketplaceStyles };
