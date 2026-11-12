import type { TokenProvider } from "./core/auth/credentials.js";
import type { CoreClientOptions } from "./core/client-options.js";
import { ServerEnvironment } from "./servers.js";

export type ClientOptions = SdkClientOptions & CoreClientOptions;

type SdkClientOptions = ServerOptions & {
  /**
   * Buyer session or scoped agent/admin credential. Production issues expiring, revocable tokens,
   * verifies issuer/audience/signature, and derives principal server-side. Mock tokens are
   * buyer-demo, buyer-other, agent-alpha, agent-beta, and admin-demo.
   */
  readonly bearerAuth?: TokenProvider | undefined;
};

type ServerOptions =
  | {
      readonly serverEnvironment?: typeof ServerEnvironment.Production;
      /** Live sandbox API (PayPal sandbox). */
      readonly serverOptions?: {
        baseUrl?: string;
      };
    }
  | {
      readonly serverEnvironment: typeof ServerEnvironment.Environment2;
      /** Live sandbox API (PayPal sandbox). */
      readonly serverOptions?: {
        baseUrl?: string;
      };
    };
