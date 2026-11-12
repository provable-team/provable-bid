"use client";

import { useState } from "react";
import Link from "next/link";
import { designExamples } from "@/lib/design-examples";
import styles from "./design-showcase.module.css";

const filters = ["All projects", "Posters", "Business cards"] as const;

export function DesignShowcase() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All projects");
  const visible = designExamples.filter(
    (example) => filter === "All projects" || example.category === filter,
  );

  return (
    <section id="examples" className={styles.section} aria-labelledby="examples-title">
      <div className={styles.heading}>
        <div>
          <p className="eyebrow">Small briefs. Big possibilities.</p>
          <h2 id="examples-title">A little proof of possibility.</h2>
          <p className={styles.intro}>
            A gig to announce. A studio to introduce. Explore finished design
            samples, then give the agents a brief of your own.
          </p>
        </div>
        <span className={styles.edition}>THE DESIGN EDIT<br />VOL. 01 — {String(designExamples.length).padStart(2, "0")} PROJECTS</span>
      </div>
      <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label="Filter sample projects">
          {filters.map((item) => (
            <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>
              {item}
            </button>
          ))}
        </div>
        <p>AI-created samples · fictional briefs</p>
      </div>
      <div className={styles.grid} aria-live="polite" aria-relevant="additions removals">
        {visible.map((example) => (
          <article className={styles.project} key={example.id}>
            <a className={styles.artwork} style={{ background: example.color }} href={`/examples/${example.file}.html`} aria-label={`Open ${example.title} ${example.kind.toLowerCase()} sample`}>
              <span className={styles.number}>{String(designExamples.indexOf(example) + 1).padStart(2, "0")} / DESIGN STUDY</span>
              <img src={`/examples/${example.file}.svg`} alt={`${example.title}: ${example.kind}`} loading="lazy" width="700" height="800" />
              <span className={styles.open}>Explore project <span aria-hidden="true">↗</span></span>
            </a>
            <div className={styles.projectHeading}>
              <h3><a href={`/examples/${example.file}.html`}>{example.title}</a></h3>
              <span>{example.kind}</span>
            </div>
            <p className={styles.description}>{example.description}</p>
            <div className={styles.projectFooter}>
              <span>{example.creator} · AI design sample</span>
              <Link href={`/briefs/new?example=${example.id}`}>Start a similar brief <span aria-hidden="true">↗</span></Link>
            </div>
          </article>
        ))}
      </div>
      <p className={styles.note}>
        These public samples were created for fictional projects, with downloadable
        SVG artwork and browser print layouts. They are separate from paid
        competitions. Your own brief runs through the live agent and qualification flow.
      </p>
    </section>
  );
}
