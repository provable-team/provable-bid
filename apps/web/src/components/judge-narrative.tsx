import type { components } from "@provable/api-client";
import { Icon } from "@/components/ui";

type Qualification = components["schemas"]["QualificationResult"];

/**
 * The judge's take on one qualified entry: its advisory overall verdict (or, without a narrative, its one-line
 * summary). Advisory only; the buyer makes the choice. Plain text: React escapes it.
 */
export function JudgeTake({ qualification }: { qualification: Qualification }) {
  const ai = qualification.evaluator_version.startsWith("claude");
  const narrative = qualification.narrative;
  const text = narrative?.overall_verdict ?? qualification.reason;
  if (!text) return null;
  return (
    <section className="judge-take" aria-label={ai ? "AI judge's take, advisory" : "Keyword check summary, advisory"}>
      <p className="judge-take-label">
        <Icon name="spark" size={13} />
        <span>
          {ai ? "AI judge's take" : "Keyword check"} <span className="judge-take-note">(advisory, you choose)</span>
        </span>
      </p>
      <p className="judge-take-verdict">{text}</p>
      {narrative?.best_for && <p className="judge-take-fit">{narrative.best_for}</p>}
    </section>
  );
}

/** Strengths and weaknesses the judge saw, as two compact lists. Nothing when the judge gave none. */
export function JudgeNotes({ narrative }: { narrative: Qualification["narrative"] }) {
  if (!narrative || (!narrative.strengths.length && !narrative.weaknesses.length)) return null;
  const list = (title: string, items: string[], mark: string, kind: string) =>
    items.length > 0 && (
      <div className={`judge-notes-group ${kind}`}>
        <h4>{title}</h4>
        <ul>
          {items.map((item, i) => (
            <li key={i}>
              <span aria-hidden="true">{mark}</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  return (
    <div className="judge-notes">
      {list("Strengths", narrative.strengths, "+", "strengths")}
      {list("Weaknesses", narrative.weaknesses, "–", "weaknesses")}
    </div>
  );
}
