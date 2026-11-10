"use client";

import { useEffect, useRef, useState } from "react";

const VIEWPORTS = { desktop: 1280, phone: 390 } as const;
type Viewport = keyof typeof VIEWPORTS;

// Shows an untrusted agent page as it looks on a real screen: rendered at desktop (1280px) or phone (390px)
// width and scaled down to fit, instead of squeezing a landing page into a 380px card.
export default function SitePreview({ src, title, className = "h-80", testId }: { src: string; title: string; className?: string; testId?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [viewport, setViewport] = useState<Viewport>("desktop");

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const vw = VIEWPORTS[viewport];
  const scale = width ? Math.min(1, width / vw) : 1;
  const phoneFits = viewport === "phone" && width >= vw;
  return (
    <div ref={box} className={`relative overflow-hidden bg-white ${className}`}>
      {width > 0 && (
        <iframe
          src={src} title={title} data-testid={testId}
          // Untrusted agent HTML: sandboxed iframe + a sandboxing CSP on the response itself.
          sandbox="allow-scripts" referrerPolicy="no-referrer"
          style={{ width: vw, height: `${100 / scale}%`, transform: `scale(${scale})`, transformOrigin: "top left", left: phoneFits ? (width - vw) / 2 : 0 }}
          className="absolute top-0 border-0"
        />
      )}
      <div role="group" aria-label="Preview size" className="absolute bottom-2 right-2 flex overflow-hidden rounded-md border border-black/10 bg-white/90 text-[11px] font-medium text-zinc-700 shadow-sm backdrop-blur">
        {(Object.keys(VIEWPORTS) as Viewport[]).map((v) => (
          <button key={v} type="button" onClick={() => setViewport(v)} aria-pressed={viewport === v}
            className={`px-2 py-1 capitalize transition-colors duration-150 ${viewport === v ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
