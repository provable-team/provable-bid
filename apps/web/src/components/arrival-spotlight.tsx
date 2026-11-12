"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export type Arrival = { id: string; label: string; announcement: string };
/**
 * A house agent still building: `id` matches the placeholder card's data-building-id, `step` is the API's step
 * index (a change moves the cursor there), `label` is the badge text, `region` (0 top … 1 bottom) is where on the
 * card's sketch that step belongs, and `announcement` (optional) is read out once for that step. Only for
 * milestones such as "submitted": routine steps stay silent.
 */
export type BuildMove = { id: string; step: number; label: string; region: number; announcement?: string };
/** What the gallery should show for the spotlight right now. */
export type SpotlightState = {
  /** Newly arrived cards still out of focus (blurred until the cursor reaches them). */
  arriving: ReadonlySet<string>;
  /** Cards the cursor has just reached: accent glow, shimmer sweep, blur to sharp. */
  revealing: ReadonlySet<string>;
  /** The building placeholder the cursor is on. */
  focus: string | null;
};

type Move = { kind: "arrival" | "progress"; id: string; label: string; region: number };

const TRAVEL = 800; // cursor travel between cards
const ARRIVAL_DWELL = 2000; // at least 2s on each newly qualified card
const BUILD_DWELL = 1200;
const HOLD = 1500; // final state before the cursor fades

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
const reducedMotion = () =>
  typeof window === "undefined" ||
  typeof window.matchMedia !== "function" ||
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A labelled cursor, a spotlight (the rest of the gallery dims slightly) and an accent glow that follow real events.
 * Building: while a house agent works, the cursor moves within its placeholder card to the part of the page that
 * its latest real build step is about, following whichever agent moved most recently.
 * Arrival: when a qualified entry actually reaches the gallery, the cursor travels to its card, which sharpens with
 * a glow and a shimmer. Entries already present when the gallery mounts appear without the effect.
 * If the card is off-screen, a small pill at the bottom of the viewport says what happened and scrolls to it.
 * Off when the viewer prefers reduced motion (the cards carry the same status as static text); milestones are
 * announced politely to screen readers.
 */
export function ArrivalSpotlight({
  items,
  building = [],
  children,
}: {
  items: Arrival[];
  building?: BuildMove[];
  children: (state: SpotlightState) => ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string> | null>(null);
  const steps = useRef(new Map<string, number>());
  const queue = useRef<Move[]>([]);
  const running = useRef(false);
  const mounted = useRef(true);
  const active = useRef(0);
  const resting = useRef<Move | null>(null);
  const [arriving, setArriving] = useState<ReadonlySet<string>>(new Set());
  const [revealing, setRevealing] = useState<ReadonlySet<string>>(new Set());
  const [focus, setFocus] = useState<string | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0, label: "", on: false });
  const [jump, setJump] = useState(false);
  const [away, setAway] = useState<null | "up" | "down">(null);
  const [said, setSaid] = useState("");
  const key = items.map((i) => i.id).join(",");
  const buildKey = building.map((b) => `${b.id}:${b.step}:${b.label}`).join(",");
  const latestBuild = useRef<BuildMove[]>(building);
  latestBuild.current = building;
  active.current = building.length;

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
    // Arrivals go ahead of any pending build step.
    queue.current = [
      ...queue.current.filter((m) => m.kind === "arrival"),
      ...fresh.map((f) => ({ kind: "arrival" as const, id: f.id, label: f.label, region: 0.38 })),
      ...queue.current.filter((m) => m.kind !== "arrival"),
    ];
    if (!running.current) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Build steps: follow the agent with the most recent real step (the API order puts it last).
  useLayoutEffect(() => {
    const first = steps.current.size === 0;
    const changed = building.filter((b) => steps.current.get(b.id) !== b.step);
    for (const id of [...steps.current.keys()]) if (!building.some((b) => b.id === id)) steps.current.delete(id);
    for (const b of changed) steps.current.set(b.id, b.step);
    const spoken = changed.filter((b) => b.announcement && !first).map((b) => b.announcement!);
    if (spoken.length) setSaid(spoken.join(" "));
    if (reducedMotion()) return;
    const latest = changed.at(-1);
    if (!latest) {
      // Cards may have moved or gone (an entry arrived, a placeholder ended): keep the resting cursor on target.
      const fallback = building.at(-1);
      if (!running.current && resting.current && !aim(resting.current) && fallback)
        aim({ kind: "progress", id: fallback.id, label: fallback.label, region: fallback.region });
      return;
    }
    // Only the newest step is worth showing: older build steps still waiting are dropped.
    queue.current = [
      ...queue.current.filter((m) => m.kind === "arrival"),
      { kind: "progress", id: latest.id, label: latest.label, region: latest.region },
    ];
    if (!running.current) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildKey]);

  // Building finished (nothing left to follow) while the cursor was resting: put it away.
  useLayoutEffect(() => {
    if (!building.length && !running.current && resting.current?.kind === "progress") void putAway();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building.length]);

  // Off-screen check: the pill shows only while the cursor's card is outside the viewport.
  useEffect(() => {
    let pending = false;
    const onScroll = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        checkVisible();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cardFor(move: Move) {
    const box = host.current;
    if (!box) return undefined;
    const attr = move.kind === "arrival" ? "submissionId" : "buildingId";
    return [...box.querySelectorAll<HTMLElement>(move.kind === "arrival" ? "[data-submission-id]" : "[data-building-id]")].find(
      (el) => el.dataset[attr] === move.id,
    );
  }

  function checkVisible() {
    const move = resting.current;
    const card = move ? cardFor(move) : undefined;
    if (!move || !card) return setAway(null);
    const r = card.getBoundingClientRect();
    const h = window.innerHeight;
    // "Visible" means the part the cursor points at is on screen, not just a sliver of the card.
    const y = r.top + r.height * (move.kind === "arrival" ? 0.38 : 0.1 + move.region * 0.55);
    setAway(y < 40 ? "up" : y > h - 90 ? "down" : null);
  }

  /** Points the cursor at a card (at the region of the current step); false if the card is not on the page. */
  function aim(move: Move) {
    const box = host.current;
    const card = cardFor(move);
    if (!box || !card) return false;
    const h = box.getBoundingClientRect();
    const art = (card.querySelector<HTMLElement>(".submission-art") ?? card).getBoundingClientRect();
    const r = move.kind === "arrival" ? card.getBoundingClientRect() : art;
    const y = move.kind === "arrival" ? r.top + r.height * 0.38 : r.top + r.height * (0.12 + move.region * 0.76);
    // Wander a little across the sketch so successive steps visibly move, and keep the badge inside the gallery.
    const across = move.kind === "arrival" ? 0.5 : 0.32 + ((move.region * 7) % 1) * 0.3;
    const badge = move.label.length * 7.6 + 64;
    const x = Math.max(r.left - h.left + 12, Math.min(r.left - h.left + r.width * across, h.width - badge));
    setCursor({ x, y: y - h.top, label: move.label, on: true });
    resting.current = move;
    setFocus(move.kind === "progress" ? move.id : null);
    checkVisible();
    return true;
  }

  async function putAway() {
    resting.current = null;
    setFocus(null);
    setAway(null);
    setCursor((c) => ({ ...c, on: false }));
  }

  async function run() {
    running.current = true;
    while (queue.current.length && mounted.current) {
      const next = queue.current.shift()!;
      await sleep(30); // let the card mount and lay out
      if (!cardFor(next)) {
        if (next.kind === "arrival") setArriving((prev) => without(prev, next.id));
        continue; // its card is gone (submitted, removed)
      }
      if (!resting.current) {
        // Enter from the gallery heading, so the viewer sees where the cursor comes from.
        setJump(true);
        setCursor((c) => ({ ...c, x: 24, y: -46, label: next.label, on: true }));
        await frame();
        await frame();
        setJump(false);
        await frame();
      }
      aim(next);
      await sleep(TRAVEL);
      if (!mounted.current) break;
      if (next.kind === "arrival") {
        setArriving((prev) => without(prev, next.id));
        setRevealing((prev) => new Set([...prev, next.id]));
        await sleep(ARRIVAL_DWELL);
        setRevealing((prev) => without(prev, next.id));
      } else await sleep(BUILD_DWELL);
    }
    running.current = false;
    if (!mounted.current) return;
    if (queue.current.length) return void run();
    // While agents are still building, the cursor stays with the last one that moved.
    if (active.current && resting.current?.kind === "progress" && cardFor(resting.current)) return;
    if (active.current) {
      const latest = latestBuild.current.at(-1);
      if (latest && aim({ kind: "progress", id: latest.id, label: latest.label, region: latest.region })) return;
    }
    await sleep(HOLD);
    if (mounted.current && !running.current && !queue.current.length) void putAway();
  }

  const style = { "--sx": `${cursor.x}px`, "--sy": `${cursor.y}px` } as CSSProperties;
  const on = cursor.on ? "on" : "";
  return (
    <div ref={host} className={`spotlight-host ${jump ? "jump" : ""} ${cursor.on && away ? "away" : ""}`} style={style}>
      {children({ arriving, revealing, focus })}
      <div className={`spotlight-dim ${on}`} aria-hidden="true" />
      <div className={`spotlight-light ${on}`} aria-hidden="true" />
      <div className={`spotlight-cursor ${on}`} aria-hidden="true">
        <span className="spotlight-halo" />
        <svg width="30" height="30" viewBox="0 0 24 24">
          <path d="M4 3l16 8.5-7.2 2.1L10.5 21 4 3z" />
        </svg>
        <span className="spotlight-badge">{cursor.label}</span>
      </div>
      {cursor.on && away && (
        <button
          type="button"
          className="spotlight-pill"
          onClick={() => {
            const card = resting.current && cardFor(resting.current);
            card?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
          }}
        >
          {cursor.label} <span aria-hidden="true">{away === "down" ? "↓" : "↑"}</span>
        </button>
      )}
      <p className="visually-hidden" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

function without(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!set.has(id)) return set;
  const n = new Set(set);
  n.delete(id);
  return n;
}
