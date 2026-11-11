"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApi } from "./api-provider";
import { Icon } from "./ui";

export function SiteChrome() {
  const path = usePathname();
  const { config, error, settings, updateSettings, reconnect } = useApi();
  const dialog = useRef<HTMLDialogElement>(null);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [token, setToken] = useState(settings.token);
  const [formError, setFormError] = useState("");
  useEffect(() => {
    setBaseUrl(settings.baseUrl);
    setToken(settings.token);
  }, [settings]);
  return (
    <>
      <div className="mode-banner">
        <span className={`status-dot ${config ? "" : "offline"}`} />
        {config?.mode === "mock"
          ? "Local demo · simulated payments, generation & payouts"
          : config?.mode === "paypal_sandbox"
            ? "PayPal sandbox · test payments"
            : error
              ? "API connection needs attention"
              : "Connecting to your creative marketplace"}
        <button onClick={() => dialog.current?.showModal()}>
          Connection settings <span aria-hidden="true">↗</span>
        </button>
      </div>
      <header className="site-header">
        <Link href="/" className="wordmark" aria-label="provable.bid home">
          <span className="brand-symbol">
            p<span>↗</span>
          </span>
          provable<span className="wordmark-dot">.</span>bid
        </Link>
        <nav aria-label="Main navigation">
          <Link className={path === "/" ? "active" : ""} href="/">
            Explore
          </Link>
          <Link className={path === "/library" ? "active" : ""} href="/library">
            My workspace
          </Link>
        </nav>
        <Link href="/briefs/new" className="button primary header-cta">
          Post a brief <Icon name="plus" size={17} />
        </Link>
      </header>
      <dialog
        ref={dialog}
        className="connection-dialog"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current.close();
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            try {
              updateSettings({ baseUrl, token });
              setFormError("");
              dialog.current?.close();
            } catch (err) {
              setFormError(
                err instanceof Error
                  ? err.message
                  : "Could not save the connection.",
              );
            }
          }}
        >
          <div className="section-heading">
            <h2>Connect your API</h2>
            <button
              type="button"
              className="icon-button"
              aria-label="Close settings"
              onClick={() => dialog.current?.close()}
            >
              <Icon name="close" />
            </button>
          </div>
          <p className="muted">
            Use the local fixture or your backend. The buyer credential stays in
            this browser session.
          </p>
          <label className="field">
            API base URL
            <input
              type="url"
              required
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </label>
          <label className="field">
            Buyer bearer token
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
          <p className="field-help">
            Local fixture: http://127.0.0.1:4010 with buyer-demo. Never enter an
            administrator credential.
          </p>
          {formError && (
            <p className="error-message" role="alert">
              {formError}
            </p>
          )}
          <div className="button-row">
            <button className="button primary" type="submit">
              Save connection <Icon name="arrow" />
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={reconnect}
            >
              Reconnect
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link href="/" className="footer-brand">
        provable.bid
      </Link>
      <span>Hire by proof, not promises.</span>
      <span>Built for the PayPal AI Hackathon</span>
    </footer>
  );
}
