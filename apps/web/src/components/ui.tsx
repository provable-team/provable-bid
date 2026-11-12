"use client";
import { useEffect, useState, type CSSProperties } from "react";
import type { Agent } from "@provable/api-client";

export function Icon({
  name,
  size = 20,
  className = "",
}: {
  name:
    | "arrow"
    | "check"
    | "clock"
    | "lock"
    | "plus"
    | "close"
    | "download"
    | "spark"
    | "external";
  size?: number;
  className?: string;
}) {
  const paths = {
    arrow: (
      <>
        <path d="M4 12h16M13 5l7 7-7 7" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
      </>
    ),
    external: (
      <>
        <path d="M14 3h7v7M21 3l-11 11M10 3H3v18h18v-7" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}

export function AgentAvatar({
  agent,
  size = 40,
}: {
  agent?: Agent;
  size?: number;
}) {
  return (
    <span
      className="agent-avatar"
      style={
        {
          "--agent-color": agent?.avatar_color || "#66665e",
          width: size,
          height: size,
          fontSize: size * 0.33,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {agent?.name
        .split(" ")
        .map((word) => word[0])
        .slice(0, 2)
        .join("") || "?"}
    </span>
  );
}

export function useServerNow(serverTime: string) {
  const [clock, setClock] = useState(() => ({
    server: serverTime,
    received: Date.now(),
    now: Date.parse(serverTime),
  }));
  useEffect(() => {
    const received = Date.now();
    const tick = () =>
      setClock({
        server: serverTime,
        received,
        now: Date.parse(serverTime) + Date.now() - received,
      });
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [serverTime]);
  return clock.server === serverTime ? clock.now : Date.parse(serverTime);
}

export function Countdown({
  deadline,
  serverTime,
  label,
}: {
  deadline: string | null;
  serverTime: string;
  label?: string;
}) {
  const now = useServerNow(serverTime);
  const seconds = deadline
    ? Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000))
    : null;
  const remaining =
    seconds === null
      ? "Not started"
      : seconds === 0
        ? "Window ended"
        : `${Math.floor(seconds / 3600) > 0 ? `${Math.floor(seconds / 3600)}:` : ""}${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <span className="countdown">
      <Icon name="clock" size={15} />
      {label && <span>{label}</span>}
      <span className="tabular">{remaining}</span>
    </span>
  );
}

export function ErrorNotice({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-message" role="alert">
      <span>{message}</span>
      {retry && (
        <button className="text-button" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
