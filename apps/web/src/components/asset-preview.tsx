"use client";
import { useEffect, useRef, useState } from "react";
import type { Artifact } from "@provable/api-client";
import { fetchProtected, protectedUrl } from "@/lib/api";
import { useApi } from "./api-provider";
import { Icon } from "./ui";

const VIEWPORTS = { desktop: 1280, phone: 390 } as const;
type Viewport = keyof typeof VIEWPORTS;

/**
 * A qualified website, as it looks on a real screen. The preview HTML is fetched with the buyer
 * credential and rendered from a blob URL in a sandboxed iframe without allow-same-origin, so agent
 * code can't read this app's storage or credential. The API also injects a strict CSP and a watermark.
 */
export function AssetPreview({
  artifact,
  className = "",
  alt = "Qualified website preview",
}: {
  artifact: Artifact;
  className?: string;
  alt?: string;
}) {
  const { settings } = useApi();
  const [state, setState] = useState<{ src?: string; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [width, setWidth] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (typeof ResizeObserver === "undefined") {
      setWidth(el.clientWidth || 640);
      return;
    }
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    setState(null);
    async function load() {
      const url = new URL(protectedUrl(artifact.preview.url, settings.baseUrl));
      const expectedPath = `${new URL(settings.baseUrl).pathname.replace(/\/$/, "")}/v1/assets/${encodeURIComponent(artifact.asset_id)}/preview`;
      if (url.pathname !== expectedPath || url.search)
        throw new Error("The preview URL is not the asset preview gateway.");
      const response = await fetchProtected(url.href, settings, controller.signal);
      if (response.headers.get("content-type")?.split(";")[0] !== "text/html")
        throw new Error("This preview has an unsupported format.");
      const html = await response.text();
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      setState({ src: objectUrl });
    }
    load().catch((err: unknown) => {
      if (!controller.signal.aborted)
        setState({ error: err instanceof Error ? err.message : "Preview unavailable." });
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [artifact.asset_id, artifact.preview.url, settings, attempt]);

  const vw = VIEWPORTS[viewport];
  const scale = width ? Math.min(1, width / vw) : 1;
  return (
    <div ref={box} className={`site-preview ${className}`}>
      {state?.error ? (
        <div className="preview-placeholder">
          <Icon name="lock" />
          <span>{state.error}</span>
          <button className="text-button" onClick={() => setAttempt((n) => n + 1)}>
            Reload preview
          </button>
        </div>
      ) : !state?.src || !width ? (
        <div className="preview-placeholder skeleton" aria-label="Loading protected preview" />
      ) : (
        <iframe
          src={state.src}
          title={alt}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          style={{
            width: vw,
            height: `${100 / scale}%`,
            transform: `scale(${scale})`,
            left: viewport === "phone" && width > vw ? (width - vw) / 2 : 0,
          }}
        />
      )}
      <div className="viewport-toggle" role="group" aria-label="Preview size">
        {(Object.keys(VIEWPORTS) as Viewport[]).map((v) => (
          <button key={v} type="button" aria-pressed={viewport === v} onClick={() => setViewport(v)}>
            {v === "desktop" ? "Desktop" : "Phone"}
          </button>
        ))}
      </div>
    </div>
  );
}
