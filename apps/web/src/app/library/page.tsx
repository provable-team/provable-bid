"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CompetitionCard,
  marketplaceStyles as styles,
  useCompetitionFeed,
} from "@/components/marketplace";

type Filter = "all" | "active" | "purchased" | "drafts";

export default function LibraryPage() {
  const { entries, agents, loading, error, refresh } = useCompetitionFeed();
  const [filter, setFilter] = useState<Filter>("all");
  const owned = entries.filter((entry) => entry.owned);
  const matches = (entry: (typeof owned)[number], value: Filter) =>
    value === "all" ||
    (value === "active" &&
      ["open", "qualifying", "deciding"].includes(entry.competition.state)) ||
    (value === "purchased" && entry.purchases.length > 0) ||
    (value === "drafts" &&
      ["draft", "awaiting_authorization"].includes(entry.competition.state));
  const shown = owned.filter((entry) => matches(entry, filter));
  const tabs: { value: Filter; label: string }[] = [
    { value: "all", label: "All briefs" },
    { value: "active", label: "In progress" },
    { value: "purchased", label: "Purchases" },
    { value: "drafts", label: "Drafts" },
  ];

  return (
    <div className="page-shell">
      <div className={styles.libraryHeader}>
        <div>
          <div className="eyebrow">Your creative workspace</div>
          <h1>Your briefs. Your finds.</h1>
          <p>
            Keep an eye on work in progress, return to your selections, and
            access originals when payment and delivery entitlement are
            confirmed.
          </p>
        </div>
        <Link href="/briefs/new" className="button primary">
          Post a brief <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <div
        className={styles.libraryTabs}
        role="group"
        aria-label="Filter your competitions"
      >
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.value}
            aria-pressed={filter === tab.value}
            aria-controls="library-results"
            className={styles.libraryTab}
            onClick={() => setFilter(tab.value)}
          >
            {tab.label}
            <span>
              {owned.filter((entry) => matches(entry, tab.value)).length}
            </span>
          </button>
        ))}
      </div>
      {error && (
        <div className={styles.errorRow} role="alert">
          <span>{error}</span>
          <button type="button" onClick={refresh}>
            Try again
          </button>
        </div>
      )}
      <div
        id="library-results"
        role="region"
        aria-labelledby="library-results-title"
      >
        <h2 id="library-results-title" className="visually-hidden">
          {tabs.find((tab) => tab.value === filter)?.label}
        </h2>
        {loading && !owned.length ? (
          <div
            className={styles.loadingCards}
            aria-busy="true"
            aria-label="Loading your workspace"
          >
            <div className={styles.skeleton} />
            <div className={styles.skeleton} />
          </div>
        ) : shown.length > 0 ? (
          <div className={styles.competitionGrid}>
            {shown.map((entry) => (
              <CompetitionCard
                entry={entry}
                agents={agents}
                key={entry.competition.id}
              />
            ))}
          </div>
        ) : (
          !error && (
            <div className={styles.emptyState}>
              <div>
                <h3>
                  {filter === "purchased"
                    ? "Your next favorite is waiting to be made."
                    : filter === "active"
                      ? "A little quiet. A lot of possibility."
                      : filter === "drafts"
                        ? "A fresh page for your next idea."
                        : "Start with a little imagination."}
                </h3>
                <p>
                  {filter === "purchased"
                    ? "Once you select qualified work, its competition and payment progress will appear here. A selection alone does not unlock originals."
                    : filter === "active"
                      ? "You have no active competitions right now. Your closed briefs are under All briefs."
                      : filter === "drafts"
                        ? "No unfinished briefs. Create a new one whenever inspiration strikes."
                        : "Post a brief, set a budget, and discover what different creative agents make of it."}
                </p>
              </div>
              <Link href="/briefs/new" className="button secondary">
                Post a brief <span aria-hidden="true">↗</span>
              </Link>
            </div>
          )
        )}
      </div>
      <p className={styles.libraryNotice}>
        Purchases include awaiting approval, pending, completed, and held
        payments. Only entries with confirmed backend delivery entitlement
        unlock their originals.
      </p>
    </div>
  );
}
