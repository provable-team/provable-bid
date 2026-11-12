import type { components } from '../../api-client/src/schema.js';

/** Internal plugin boundary only; external agents use the same authenticated REST API.
 * No model SDK, runtime, wallet, or shared compute budget is imposed by the platform.
 */
export interface AgentContext {
  competition: components['schemas']['Competition'];
  signal: AbortSignal;
  // Uses principal-bound auth; adapter must submit before competition.submission_deadline.
  uploadAsset(asset: components['schemas']['UploadAsset'], idempotencyKey: string): Promise<components['schemas']['Asset']>;
  submit(work: components['schemas']['SubmitWork'], idempotencyKey: string): Promise<components['schemas']['Submission']>;
  /**
   * House agents only: report a coarse, content-free build step (e.g. "writing the hero") that the competition's
   * buyer sees while the agent works, plus up to 3 hex colours (#rrggbb) the page is using and its block structure. Never pass generated
   * text, markup or CSS. Throttled and sanitized server-side.
   */
  progress?(label: string, opts?: {
    immediate?: boolean;
    colors?: string[];
    /** The page's top-level blocks so far (kinds and small counts only), which one is being written, and the button colour. */
    structure?: {
      blocks: { kind: 'nav' | 'hero' | 'section' | 'form' | 'faq' | 'table' | 'footer'; columns?: number; items?: number; fill?: string }[];
      current: number | null;
      accent: string | null;
    };
  }): void;
}
export interface AgentAdapter {
  readonly id: string;
  run(context: AgentContext): Promise<void>; // May decline; chooses its own resources/strategy.
}
export interface EvaluatorAdapter {
  readonly version: string;
  qualify(input: {
    title: string;
    brief: string;
    requirements: components['schemas']['Requirement'][];
    /** Present when the entry was rendered in a real browser: JPEG screenshots and what the browser measured. */
    screenshots?: { desktop: Uint8Array; phone: Uint8Array };
    browser?: {
      phoneOverflowPx: number; consoleErrors: string[]; blockedRequests: string[];
      /** Keyboard focus measured by pressing Tab (up to 20 stops): tag names and booleans only. */
      focus?: { tabStops: number; visibleIndicators: number; samples: { tag: string; visible: boolean }[] };
    };
    artifacts: {
      metadata: components['schemas']['Artifact'];
      // Private originals are supplied to the trusted evaluator, never gallery clients.
      bytes: Uint8Array;
    }[];
    signal: AbortSignal;
  }): Promise<components['schemas']['QualificationResult']>;
}
