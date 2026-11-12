"use client";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export type Arrival = { id: string; label: string; announcement: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reducedMotion = () =>
  typeof window === "undefined" ||
  typeof window.matchMedia !== "function" ||
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * When a qualified entry actually reaches the gallery, a labelled cursor glides to its card, a soft light follows,
 * and the card comes into focus. It is driven only by real arrivals (entries the API returned that this page had
 * not shown before); entries already present when the gallery mounts appear without the effect. Off when the
 * viewer prefers reduced motion; arrivals are also announced to screen readers.
 */
export function ArrivalSpotlight({
  items,
  children,
}: {
  items: Arrival[];
  children: (arriving: ReadonlySet<string>) => ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string> | null>(null);
  const queue = useRef<Arrival[]>([]);
  const running = useRef(false);
  const mounted = useRef(true);
  const [arriving, setArriving] = useState<ReadonlySet<string>>(new Set());
  const [cursor, setCursor] = useState({ x: 0, y: 0, label: "", on: false });
  const [said, setSaid] = useState("");
  const key = items.map((i) => i.id).join(",");

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Layout effect so a new card is blurred before the first paint instead of flashing in.
  useLayoutEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(items.map((i) => i.id));
      return;
    }
    const fresh = items.filter((i) => !seen.current!.has(i.id));
    if (!fresh.length) return;
    for (const f of fresh) seen.current.add(f.id);
    setSaid(fresh.map((f) => f.announcement).join(" "));
    if (reducedMotion()) return;
    setArriving((prev) => new Set([...prev, ...fresh.map((f) => f.id)]));
    queue.current.push(...fresh);
    if (!running.current) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  async function run() {
    running.current = true;
    while (queue.current.length && mounted.current) {
      const next = queue.current.shift()!;
      await sleep(30); // let the card mount and lay out
      const box = host.current;
      const card = box
        ? [...box.querySelectorAll<HTMLElement>("[data-submission-id]")].find((el) => el.dataset.submissionId === next.id)
        : undefined;
      if (box && card) {
        const h = box.getBoundingClientRect();
        const r = card.getBoundingClientRect();
        setCursor({ x: r.left - h.left + r.width * 0.5, y: r.top - h.top + r.height * 0.38, label: next.label, on: true });
      }
      await sleep(620); // cursor travel
      if (!mounted.current) break;
      setArriving((prev) => {
        const n = new Set(prev);
        n.delete(next.id);
        return n;
      });
      await sleep(900); // dwell so the viewer can follow
    }
    await sleep(500);
    if (mounted.current) setCursor((c) => ({ ...c, on: false }));
    running.current = false;
  }

  const style = { "--sx": `${cursor.x}px`, "--sy": `${cursor.y}px` } as CSSProperties;
  return (
    <div ref={host} className="spotlight-host" style={style}>
      {children(arriving)}
      <div className={`spotlight-light ${cursor.on ? "on" : ""}`} aria-hidden="true" />
      <div className={`spotlight-cursor ${cursor.on ? "on" : ""}`} aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path d="M4 3l16 8.5-7.2 2.1L10.5 21 4 3z" />
        </svg>
        <span className="spotlight-badge">{cursor.label}</span>
      </div>
      <p className="visually-hidden" aria-live="polite">
        {said}
      </p>
    </div>
  );
}
