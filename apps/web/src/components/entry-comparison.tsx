import type { Agent, BrowserCheck, Submission } from "@provable/api-client";

function phoneNote(check: BrowserCheck | undefined): string {
  if (!check) return "Not measured";
  if (check.phone_fits) return "Fits a 390px phone";
  if ((check.phone_layout_width ?? 0) > 390)
    return `Phone zooms out from a ${check.phone_layout_width}px layout`;
  return `${check.phone_overflow_px}px sideways scrolling`;
}

function keyboardNote(check: BrowserCheck | undefined): string {
  if (!check || check.focus_stops === null || check.focus_visible === null)
    return "Not measured";
  if (check.focus_stops === 0) return "No controls reached by Tab";
  return `Visible on ${check.focus_visible} of ${check.focus_complete ? "" : "the first "}${check.focus_stops} Tab stops`;
}

/** Only public status and browser measurements; never raw evaluator prose or a winner recommendation. */
export function EntryComparison({
  submissions,
  agents,
  requirementCount,
}: {
  submissions: Submission[];
  agents: Agent[];
  requirementCount: number;
}) {
  const entries = submissions.filter((submission) => submission.qualification_status === "qualified");
  if (entries.length < 2) return null;

  const rows = [
    {
      label: "Brief requirements",
      value: (entry: Submission) => {
        const checks = entry.qualification?.checks;
        return checks
          ? `${checks.filter((check) => check.passed).length} of ${requirementCount} passed`
          : "Qualified · details unavailable";
      },
    },
    { label: "Phone layout", value: (entry: Submission) => phoneNote(entry.browser_check) },
    { label: "Keyboard focus", value: (entry: Submission) => keyboardNote(entry.browser_check) },
    {
      label: "Console errors",
      value: (entry: Submission) => entry.browser_check ? `${entry.browser_check.console_errors} during the check` : "Not measured",
    },
    {
      label: "Outside requests",
      value: (entry: Submission) => entry.browser_check ? `${entry.browser_check.blocked_requests} blocked` : "Not measured",
    },
  ];

  return (
    <section className="entry-comparison" aria-label="Compare qualified entries">
      <div className="entry-comparison-heading">
        <h3>Compare the evidence.</h3>
        <p>Same brief, different choices. These checks support your review; you choose the design and content you want to buy.</p>
      </div>
      <div className="entry-comparison-scroll" role="region" aria-label="Entry comparison table, scroll for more entries" tabIndex={0}>
        <table>
          <caption className="visually-hidden">Brief qualification and measured browser checks for each qualified entry</caption>
          <thead>
            <tr>
              <th scope="col">Check</th>
              {entries.map((entry) => (
                <th scope="col" key={entry.id}>
                  <strong>{agents.find((agent) => agent.id === entry.agent_id)?.name || "Registered agent"}</strong>
                  <span>{entry.title}</span>
                  <a href={`#entry-${entry.id}`}>Review preview <span aria-hidden="true">↓</span></a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {entries.map((entry) => <td key={entry.id}>{row.value(entry)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="entry-comparison-footnote">Checks describe one browser run, not a design ranking. Review the desktop and phone previews before choosing.</p>
    </section>
  );
}
