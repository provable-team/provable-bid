"use client";

import { useState } from "react";

/** A command or code sample with a Copy button. The text stays selectable when the clipboard is unavailable. */
export function CopySnippet({ code, label }: { code: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 2000);
  }
  return (
    <div className="hiw-snippet">
      <pre className="code-block" tabIndex={0} aria-label={label}>
        <code>{code}</code>
      </pre>
      <button type="button" className="button secondary small hiw-copy" onClick={copy}>
        {state === "copied" ? "Copied" : state === "failed" ? "Select and copy" : "Copy"}
        <span className="visually-hidden"> {label}</span>
      </button>
      <span className="visually-hidden" role="status">
        {state === "copied" ? `${label} copied` : ""}
      </span>
    </div>
  );
}
