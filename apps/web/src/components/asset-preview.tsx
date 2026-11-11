"use client";
import { useEffect, useState } from "react";
import type { Artifact } from "@provable/api-client";
import { fetchProtected, protectedUrl } from "@/lib/api";
import { useApi } from "./api-provider";
import { Icon } from "./ui";

export function AssetPreview({
  artifact,
  className = "",
  alt = "Qualified submission preview",
}: {
  artifact: Artifact;
  className?: string;
  alt?: string;
}) {
  const { settings } = useApi();
  const [preview, setPreview] = useState<{
    src?: string;
    text?: string;
    error?: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    setPreview(null);
    async function load() {
      const url = new URL(protectedUrl(artifact.preview.url, settings.baseUrl));
      const expectedPath = `${new URL(settings.baseUrl).pathname.replace(/\/$/, "")}/v1/assets/${encodeURIComponent(artifact.asset_id)}/preview`;
      if (url.pathname !== expectedPath || url.search)
        throw new Error("The preview URL is not the asset preview gateway.");
      const response = await fetchProtected(
        url.href,
        settings,
        controller.signal,
      );
      const mime = response.headers.get("content-type")?.split(";")[0];
      if (artifact.type === "image") {
        if (mime !== "image/png")
          throw new Error("This image preview has an unsupported format.");
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setPreview({ src: objectUrl });
      } else {
        if (mime !== "text/plain")
          throw new Error("This text preview has an unsupported format.");
        const text = await response.text();
        if (!controller.signal.aborted) setPreview({ text });
      }
    }
    load().catch((err: unknown) => {
      if (!controller.signal.aborted)
        setPreview({
          error: err instanceof Error ? err.message : "Preview unavailable.",
        });
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    artifact.asset_id,
    artifact.type,
    artifact.preview.url,
    settings,
    attempt,
  ]);
  if (preview?.error)
    return (
      <div className={`preview-placeholder ${className}`}>
        <Icon name="lock" />
        <span>{preview.error}</span>
        <button
          className="text-button"
          onClick={() => setAttempt((n) => n + 1)}
        >
          Reload preview
        </button>
      </div>
    );
  if (!preview)
    return (
      <div
        className={`preview-placeholder skeleton ${className}`}
        aria-label="Loading protected preview"
      />
    );
  if (preview.src)
    return (
      <img className={`asset-image ${className}`} src={preview.src} alt={alt} />
    );
  return (
    <div className={`text-preview ${className}`}>
      <span className="eyebrow">Scene excerpt</span>
      <p>{preview.text}</p>
      <span className="muted">Full scene included with purchase</span>
    </div>
  );
}
