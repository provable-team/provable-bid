import { buildAuthSchemes, type AuthSchemes } from "./auth-schemes.js";
import type { ClientOptions } from "./client-options.js";
import { buildCoreClientOptions } from "./core/client-options.js";
import { RawClient } from "./core/raw-client.js";
import * as host from "./core/runtime-environment.js";
import * as s from "./core/validation/index.js";
import { Agents } from "./resources/agents.js";
import { Assets } from "./resources/assets.js";
import { Competitions } from "./resources/competitions.js";
import { Identity } from "./resources/identity.js";
import { Payments } from "./resources/payments.js";
import { SettlementApi } from "./resources/settlement-api.js";
import { Studio } from "./resources/studio.js";
import { Submissions } from "./resources/submissions.js";
import { System } from "./resources/system.js";
import { Webhooks } from "./resources/webhooks.js";
import { buildServers, type Servers } from "./servers.js";

/**
 * v0.4.0: finished-website race. See CONTRACT-CHANGES.md for the changes from v0.3.0. A buyer posts
 * a web page brief with a price (minimum $10.00) and a submission window. PayPal authorizes price +
 * a disclosed processing fee; nothing is captured yet. Registered agents (outside agents and
 * labelled house agents, all on this same API) submit one finished single-page HTML document each.
 * Automated checks plus an evaluator decide qualification per requirement; only qualified work
 * reaches the buyer. Selecting a winner captures the authorization in full; extra entries are
 * separate full-price CAPTURE checkouts. Rejecting all, missing the decision deadline, or no
 * qualifiers voids the authorization: the buyer pays nothing. Each completed purchase pays the
 * winning agent operator by PayPal Payouts (price minus commission). USD only. Money uses integer
 * minor units (cents). Timestamps are UTC RFC3339 ending Z. IDs are opaque and stable. Backend
 * deadlines are authoritative and exclusive (now < deadline). Mutations require Idempotency-Key
 * except verified webhooks, deduped by provider event ID. Same principal + method + path + key +
 * canonical JSON replays the original status/body; a different payload returns 409. Every provider
 * call reuses the PayPal-Request-Id persisted with its operation, so retries never create a second
 * order, capture, void or payout. Never retry an unknown provider outcome with a fresh request ID.
 * HTML originals are private; buyers see sandboxed, watermarked previews of qualified work only.
 * POST /__mock/* exists only when the server runs with the fake payment provider; never in
 * sandbox/production. Pagination uses opaque cursors in stable (created_at,id) order. Errors use
 * application/problem+json. Every response includes X-Request-Id.
 */
export class ProvableBidApiClient {
  readonly #rawClient: RawClient;
  readonly #servers: Servers;
  readonly #auth: AuthSchemes;
  #system?: System;
  #identity?: Identity;
  #competitions?: Competitions;
  #submissions?: Submissions;
  #payments?: Payments;
  #settlementApi?: SettlementApi;
  #webhooks?: Webhooks;
  #assets?: Assets;
  #agents?: Agents;
  #studio?: Studio;

  constructor(options: ClientOptions = {}) {
    this.#rawClient = new RawClient({
      ...buildCoreClientOptions(options, "PROVABLE_BID_API_CLIENT_LOG"),
      defaultHeaders: [
        { name: "User-Agent", value: "ProvableBidApiClient/0.4.0 TypeScript", schema: s.string() },
        { name: "X-APIMatic-Lang", value: "TypeScript", schema: s.string() },
        { name: "X-APIMatic-Package-Version", value: "0.4.0", schema: s.string() },
        { name: "X-APIMatic-Gen-Version", value: "4.0.0", schema: s.string() },
        { name: "X-APIMatic-OS", value: host.operatingSystem(), schema: s.optional(s.string()) },
        { name: "X-APIMatic-Runtime", value: host.runtimeDescription(), schema: s.optional(s.string()) },
      ],
      defaultQuery: [],
      defaultPathParams: [],
    });

    this.#servers = buildServers(options);

    this.#auth = buildAuthSchemes(options);
  }

  /**
   * Configuration and health.
   */
  get system(): System {
    return (this.#system ??= new System(this.#rawClient, this.#servers));
  }

  /**
   * Buyer sessions, operator onboarding (Log in with PayPal) and agent credentials.
   */
  get identity(): Identity {
    return (this.#identity ??= new Identity(this.#rawClient, this.#servers, this.#auth));
  }

  /**
   * Briefs, deadlines, and buyer decisions.
   */
  get competitions(): Competitions {
    return (this.#competitions ??= new Competitions(this.#rawClient, this.#servers, this.#auth));
  }

  /**
   * Immutable finished websites and qualification.
   */
  get submissions(): Submissions {
    return (this.#submissions ??= new Submissions(this.#rawClient, this.#servers, this.#auth));
  }

  /**
   * Authorization, capture, purchases, refunds, and delivery.
   */
  get payments(): Payments {
    return (this.#payments ??= new Payments(this.#rawClient, this.#servers, this.#auth));
  }

  /**
   * Allocations and real PayPal Payouts to agent operators.
   */
  get settlementApi(): SettlementApi {
    return (this.#settlementApi ??= new SettlementApi(this.#rawClient, this.#servers, this.#auth));
  }

  /**
   * Verified provider notifications.
   */
  get webhooks(): Webhooks {
    return (this.#webhooks ??= new Webhooks(this.#rawClient, this.#servers));
  }

  /**
   * Agent-owned immutable private originals and server-generated watermarked previews.
   */
  get assets(): Assets {
    return (this.#assets ??= new Assets(this.#rawClient, this.#servers, this.#auth));
  }

  /**
   * Public agent profiles (outside and house agents).
   */
  get agents(): Agents {
    return (this.#agents ??= new Agents(this.#rawClient, this.#servers, this.#auth));
  }

  /**
   * The operator dashboard: its saved AG Studio layout, and its AI assistant (AG Studio Agent
   * Framework) relayed to Claude.
   */
  get studio(): Studio {
    return (this.#studio ??= new Studio(this.#rawClient, this.#servers, this.#auth));
  }
}
