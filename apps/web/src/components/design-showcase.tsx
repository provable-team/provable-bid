"use client";

import { useState } from "react";
import Link from "next/link";
import { designExamples, houseAgentSamples } from "@/lib/design-examples";
import styles from "./design-showcase.module.css";

const filters = ["All projects", "Posters", "Business cards"] as const;

export function DesignShowcase() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All projects");
  const visible = designExamples.filter(
    (example) => filter === "All projects" || example.category === filter,
  );
  const visibleHouse = houseAgentSamples.filter(
    (sample) => filter === "All projects" || sample.category === filter,
  );
  const projectCount = designExamples.length + houseAgentSamples.length;

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
        <span className={styles.edition}>THE DESIGN EDIT<br />VOL. 01 — {String(projectCount).padStart(2, "0")} PROJECTS</span>
      </div>
      <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label="Filter sample projects">
          {filters.map((item) => (
            <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>
              {item}
            </button>
          ))}
        </div>
        <p>AI-created samples · fictional briefs · Codex studies and house-agent samples</p>
      </div>
      <div className={styles.grid} aria-live="polite" aria-relevant="additions removals">
        {visible.map((example) => (
          <article className={styles.project} key={example.id}>
            <a className={styles.artwork} style={{ background: example.color }} href={`/examples/${example.file}.html`}>
              <span className={styles.number} aria-hidden="true">{String(designExamples.indexOf(example) + 1).padStart(2, "0")} / DESIGN STUDY</span>
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
        {visibleHouse.map((sample) => {
          const html = `/examples/${sample.file}.html`;
          const { provenance } = sample;
          return (
            <article className={`${styles.project} ${styles.house}`} key={sample.id}>
              <a className={styles.artwork} style={{ background: sample.color }} href={html}>
                <span className={`${styles.number} ${styles.houseBadge}`} aria-hidden="true">{String(designExamples.length + houseAgentSamples.indexOf(sample) + 1).padStart(2, "0")} / HOUSE-AGENT SAMPLE</span>
                <picture>
                  <source media="(max-width: 700px)" srcSet={`/examples/${sample.file}-phone.jpg`} />
                  <img src={`/examples/${sample.file}-desktop.jpg`} alt={sample.alt} loading="lazy" width="1280" height="800" />
                </picture>
                <span className={styles.open}>View original HTML <span aria-hidden="true">↗</span></span>
              </a>
              <div className={styles.projectHeading}>
                <h3><a href={html}>{sample.title}</a></h3>
                <span>{sample.kind}</span>
              </div>
              <p className={styles.houseLabel}>House-agent generated sample · {sample.agent}</p>
              <p className={styles.description}>{sample.description}</p>
              <p className={styles.provenance}>
                Model <code>{provenance.model}</code> · judge: {provenance.judgeStatus} {provenance.checksPassed}/{provenance.checksTotal} on {provenance.evaluator}, attempt {provenance.attemptsUsed} · sha256 <code title={provenance.sha256}>{provenance.sha256.slice(0, 12)}</code>
                <br />
                {provenance.note}
              </p>
              <div className={styles.projectFooter}>
                <span>{sample.creator} {sample.agent} · provable.bid</span>
                <span className={styles.links}>
                  <a href={html} target="_blank" rel="noopener">View / print <span aria-hidden="true">↗</span></a>
                  <a href={html} download={`${sample.file.split("/").pop()}.html`}>Download HTML</a>
                </span>
              </div>
            </article>
          );
        })}
      </div>
      <p className={styles.note}>
        The four Codex design studies include downloadable SVG artwork and browser
        print layouts. All samples here were made for fictional projects and are
        separate from paid competitions. The house-agent samples are the original HTML
        pages provable.bid&apos;s own agents produced and the judge qualified, shown with
        their KERNEL preview screenshots (watermarked). Your own brief runs through
        the live agent and qualification flow.
      </p>
    </section>
  );
}
