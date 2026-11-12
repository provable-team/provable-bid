"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export type Arrival = { id: string; label: string; announcement: string };
/**
 * A house agent still building: `id` matches its placeholder card's data-building-id, `step` is the API's step
 * index, `label` the badge text, and `announcement` (optional) is read out once for that step: only for
 * milestones such as "submitted", so routine steps stay silent.
 */
export type BuildMove = { id: string; step: number; label: string; announcement?: string };
/** Spotlight phase of a qualified card: blurred until its turn, then revealed with its own cursor and light. */
export type ArrivalPhase = "arriving" | "revealing" | "fading";

const DWELL = 2000; // at least 2s on each newly qualified card
const HOLD = 1500; // final state before the cursor fades
const FADE = 400;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reducedMotion = () =>
  typeof window === "undefined" ||
  typeof window.matchMedia !== "function" ||
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const HEX = /^#[0-9a-f]{6}$/i;
const channel = (hex: string, i: number) => {
  const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const INK = "#20221d";
const WHITE = "#ffffff";

/**
 * CSS variables that paint a card's cursor, halo, glow and sketch in an agent's colours: colours[0] for the cursor and
 * halo, [1] for the glow, [2] for the sketch fill and shimmer, falling back along the list and then to `fallback`
 * (the agent's avatar colour). The badge text is ink or white, whichever contrasts more with the cursor colour.
 */
export function agentPalette(colors: readonly string[], fallback: string | undefined): CSSProperties {
  const safe = colors.filter((c) => HEX.test(c));
  const base = HEX.test(fallback ?? "") ? fallback! : "#66665e";
  const a = safe[0] ?? base;
  const b = safe[1] ?? a;
  const c = safe[2] ?? safe[1] ?? a;
  return {
    "--spot-a": a,
    "--spot-b": b,
    "--spot-c": c,
    "--spot-text": contrast(a, WHITE) >= contrast(a, INK) ? WHITE : INK,
  } as CSSProperties;
}

/**
 * One card's own cursor, halo, badge and light, drawn inside the card (which clips it). `x`/`y` are 0–1 within the
 * card's canvas; changing them glides the cursor there. `pulse` replays the halo ripple (e.g. on every new step).
 */
export function CardSpot({ x, y, label, pulse, fading = false }: { x: number; y: number; label: string; pulse?: string | number; fading?: boolean }) {
  const style = { "--cx": `${(x * 100).toFixed(1)}%`, "--cy": `${(y * 100).toFixed(1)}%` } as CSSProperties;
  return (
    <div className={`card-spot ${fading ? "fading" : ""} ${y > 0.7 ? "low" : ""}`} style={style} aria-hidden="true">
      <div className="card-spot-dim" />
      <div className="card-spot-light" />
      <div className="card-spot-cursor">
        <span className="card-spot-halo" />
        <span className="card-spot-ripple" key={pulse} />
        <svg width="28" height="28" viewBox="0 0 24 24">
          <path d="M4 3l16 8.5-7.2 2.1L10.5 21 4 3z" />
        </svg>
      </div>
      <span className="card-spot-badge">{label}</span>
    </div>
  );
}

/**
 * Real events only. Building: each house agent's placeholder card draws its own cursor (see CardSpot); this
 * component announces milestones and points to cards that are off-screen. Arrival: when a qualified entry actually
 * reaches the gallery, its card waits blurred for its turn, then sharpens with its own cursor, light and shimmer.
 * Entries already present when the gallery mounts appear without the effect. If the cards with activity are
 * off-screen, a pill at the bottom of the viewport names them and scrolls to the first. Reduced motion: no motion,
 * the cards carry the same status as static text; milestones are announced politely to screen readers.
 */
export function ArrivalSpotlight({
  items,
  building = [],
  children,
}: {
  items: Arrival[];
  building?: BuildMove[];
  children: (phase: (submissionId: string) => ArrivalPhase | null) => ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string> | null>(null);
  const steps = useRef(new Map<string, number>());
  const queue = useRef<string[]>([]);
  const running = useRef(false);
  const mounted = useRef(true);
  const [phases, setPhases] = useState<ReadonlyMap<string, ArrivalPhase>>(new Map());
  const [away, setAway] = useState<{ ids: string[]; label: string; up: boolean } | null>(null);
  const [said, setSaid] = useState("");
  const labels = useRef(new Map<string, string>());
  const key = items.map((i) => i.id).join(",");
  const buildKey = building.map((b) => `${b.id}:${b.step}:${b.label}`).join(",");
  for (const i of items) labels.current.set(i.id, i.label);
  for (const b of building) labels.current.set(b.id, b.label);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const setPhase = (id: string, phase: ArrivalPhase | null) =>
    setPhases((prev) => {
      const next = new Map(prev);
      if (phase) next.set(id, phase);
      else next.delete(id);
      return next;
    });

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
    setPhases((prev) => new Map([...prev, ...fresh.map((f) => [f.id, "arriving"] as const)]));
    queue.current.push(...fresh.map((f) => f.id));
    if (!running.current) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Milestones only (e.g. "submitted"), never each step; steps already showing on first load stay silent.
  useLayoutEffect(() => {
    const first = steps.current.size === 0;
    const changed = building.filter((b) => steps.current.get(b.id) !== b.step);
    for (const id of [...steps.current.keys()]) if (!building.some((b) => b.id === id)) steps.current.delete(id);
    for (const b of changed) steps.current.set(b.id, b.step);
    const spoken = changed.filter((b) => b.announcement && !first).map((b) => b.announcement!);
    if (spoken.length) setSaid(spoken.join(" "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildKey]);

  // Arrivals take turns: each revealed card holds the stage for its dwell, then the next one starts.
  async function run() {
    running.current = true;
    while (queue.current.length && mounted.current) {
      const id = queue.current.shift()!;
      await sleep(30); // let the card mount and lay out
      setPhase(id, "revealing");
      void (async () => {
        await sleep(DWELL + HOLD);
        if (!mounted.current) return;
        setPhase(id, "fading");
        await sleep(FADE);
        if (mounted.current) setPhase(id, null);
      })();
      await sleep(DWELL);
    }
    running.current = false;
  }

  // Off-screen activity: building cards and cards being revealed that the viewer can't see.
  function checkAway() {
    const box = host.current;
    if (!box || reducedMotion()) return setAway(null);
    const active = [
      ...building.map((b) => ({ id: b.id, el: box.querySelector<HTMLElement>(`[data-building-id="${CSS.escape(b.id)}"]`) })),
      ...[...phases.entries()]
        .filter(([, p]) => p === "revealing")
        .map(([id]) => ({ id, el: box.querySelector<HTMLElement>(`[data-submission-id="${CSS.escape(id)}"]`) })),
    ].filter((x): x is { id: string; el: HTMLElement } => !!x.el);
    const h = window.innerHeight;
    const hidden = active.filter(({ el }) => {
      const r = el.getBoundingClientRect();
      return Math.min(r.bottom, h) - Math.max(r.top, 0) < Math.min(160, r.height * 0.4);
    });
    if (!hidden.length) return setAway(null);
    const ids = hidden.map((x) => x.id);
    const label =
      hidden.length === 1
        ? labels.current.get(ids[0]) ?? ""
        : hidden.map((x) => (labels.current.get(x.id) ?? "").split(" · ")[0]).join(", ") + " · building";
    setAway({ ids, label, up: hidden[0].el.getBoundingClientRect().bottom < 0 });
  }
  const checkRef = useRef(checkAway);
  checkRef.current = checkAway;

  useLayoutEffect(() => {
    checkAway();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildKey, phases]);

  useEffect(() => {
    let pending = false;
    const onScroll = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        checkRef.current();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const phase = (id: string) => phases.get(id) ?? null;
  return (
    <div ref={host} className="spotlight-host">
      {children(phase)}
      {away && (
        <button
          type="button"
          className="spotlight-pill"
          onClick={() => {
            const id = away.ids[0];
            const el = host.current?.querySelector<HTMLElement>(
              `[data-building-id="${CSS.escape(id)}"], [data-submission-id="${CSS.escape(id)}"]`,
            );
            el?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
          }}
        >
          {away.label} <span aria-hidden="true">{away.up ? "↑" : "↓"}</span>
        </button>
      )}
      <p className="visually-hidden" aria-live="polite">
        {said}
      </p>
    </div>
  );
}
