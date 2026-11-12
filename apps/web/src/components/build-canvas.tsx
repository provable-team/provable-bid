"use client";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { BuildProgress } from "@provable/api-client";
import { CardSpot } from "@/components/arrival-spotlight";

type Block = BuildProgress["blocks"][number];

const HEX = /^#[0-9a-f]{6}$/;
const dark = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
};

/** Relative height of each kind of block, so the sketch is to scale with what the agent wrote. */
function weight(b: Block): number {
  switch (b.kind) {
    case "nav": return 0.55;
    case "hero": return 2.6;
    case "section": return 1.7;
    case "faq": return 0.6 + 0.32 * (b.items ?? 3);
    case "form": return 0.5 + 0.38 * (b.items ?? 2);
    case "table": return 0.4 + 0.28 * (b.items ?? 3);
    case "footer": return 0.6;
  }
}

function Inner({ b }: { b: Block }) {
  const n = (k: number) => Array.from({ length: k }, (_, i) => <i key={i} />);
  switch (b.kind) {
    case "nav":
      return (
        <>
          <i className="sk-logo" />
          <span className="sk-links">{n(3)}</span>
          <i className="sk-chip" />
        </>
      );
    case "hero":
      return (
        <>
          <i className="sk-title" />
          <i className="sk-title sk-short" />
          <i className="sk-line" />
          <i className="sk-chip" />
        </>
      );
    case "section":
      return (
        <>
          <i className="sk-heading" />
          <span className="sk-row">{Array.from({ length: b.columns ?? 1 }, (_, i) => <i key={i} className="sk-tile" />)}</span>
        </>
      );
    case "faq":
      return (
        <>
          <i className="sk-heading" />
          {Array.from({ length: b.items ?? 3 }, (_, i) => <i key={i} className="sk-q" />)}
        </>
      );
    case "form":
      return (
        <>
          {Array.from({ length: b.items ?? 2 }, (_, i) => <i key={i} className="sk-field" />)}
          <i className="sk-chip" />
        </>
      );
    case "table":
      return <>{Array.from({ length: b.items ?? 3 }, (_, i) => <span key={i} className="sk-tr">{n(3)}</span>)}</>;
    case "footer":
      return <i className="sk-line" />;
  }
}

/**
 * A house agent's placeholder canvas: the blocks its page actually has so far (kinds and counts from the API, never
 * content), in order and to scale, in its colours. Its cursor sits on the block being written: the last tile of a
 * multi-column section, else the block itself.
 */
export function BuildCanvas({ progress, label, cursor }: { progress: BuildProgress; label: string; cursor: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState({ x: 0.5, y: 0.14 });
  const blocks = progress.blocks;
  const current = progress.current_block;
  const key = JSON.stringify([blocks, current]);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const block = current === null ? null : el.querySelector<HTMLElement>(`[data-block="${current}"]`);
      if (!block) return setAt({ x: 0.5, y: 0.14 });
      const target = block.querySelector<HTMLElement>(".sk-tile:last-child, .sk-q:last-child, .sk-field:nth-last-child(2), .sk-tr:last-child, .sk-title") ?? block;
      const t = target.getBoundingClientRect();
      setAt({
        x: Math.min(0.92, Math.max(0.08, (t.left + t.width * 0.5 - r.left) / r.width)),
        y: Math.min(0.94, Math.max(0.06, (t.top + t.height * 0.5 - r.top) / r.height)),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [key, current]);

  const style = (HEX.test(progress.accent ?? "") ? { "--chip": progress.accent } : {}) as CSSProperties;
  return (
    <div className="build-canvas" ref={box} style={style}>
      <div className={`build-sketch ${blocks.length ? "" : "is-empty"}`}>
        {blocks.map((b, i) => {
          const fill = b.fill && HEX.test(b.fill) ? b.fill : undefined;
          const s = {
            flexGrow: weight(b),
            ...(fill ? { "--fill": fill, "--bar": dark(fill) ? "#fffef980" : "#20221d38" } : {}),
          } as CSSProperties;
          return (
            <div key={i} data-block={i} className={`sk sk-${b.kind} ${i === current && (progress.state === "building" || progress.state === "revising") ? "now" : ""}`} style={s}>
              <Inner b={b} />
            </div>
          );
        })}
      </div>
      {cursor && <CardSpot x={at.x} y={at.y} pulse={`${current}:${blocks.length}`} label={label} />}
    </div>
  );
}
