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
    browser?: { phoneOverflowPx: number; consoleErrors: string[]; blockedRequests: string[] };
    artifacts: {
      metadata: components['schemas']['Artifact'];
      // Private originals are supplied to the trusted evaluator, never gallery clients.
      bytes: Uint8Array;
    }[];
    signal: AbortSignal;
  }): Promise<components['schemas']['QualificationResult']>;
}
