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
  /** House agents only: milliseconds left in the submission window, by the API's clock. */
  timeLeftMs?(): number;
  /**
   * House agents only: resolves with this agent's own submission once its qualification has finished (read through
   * the public GET /v1/submissions/{id}, as an outside agent would), for feedback and revision.
   */
  waitForResult?(submissionId: string): Promise<components['schemas']['Submission']>;
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
/**
 * The page in print media (same browser, print emulated, viewport at the declared @page size), measured only when
 * it has print CSS. Selector hints and text snippets are short, sanitized and come from the (untrusted) page.
 */
export interface PrintMeasurement {
  checked: boolean;
  /** Why the measurement could not finish (the render itself still succeeds). */
  error?: string;
  /** The @page size the CSS declares, in mm (width, height); null when it declares none (auto). */
  page_size_mm?: [number, number] | null;
  /** Pages the browser's print engine produced (page.pdf with the CSS page size), or page-sized boxes when it could not print. */
  pages?: number | null;
  pages_source?: 'pdf' | 'page_boxes';
  /** Size of the printed pages, mm, when printed to PDF. */
  printed_size_mm?: [number, number] | null;
  /** Page-sized boxes the page draws (outermost only): each should print as one page. Absent when there are none. */
  expected_pages?: number;
  /** Text cut off by a clipping box, and fixed-size clipping boxes whose content is bigger than the box. */
  overflow?: { selector_hint: string; px: number; text?: string }[];
  /** Text runs closer than 3 mm to the edge of a page-sized box (or past it). */
  safe_area_violations?: number;
  /** Smallest visible text, pt. */
  min_font_pt?: number | null;
  /** The problems in words, at most 10. Empty means none found. */
  issues?: string[];
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
      /** CSS px the page is wider than an emulated 390px phone (sideways scroll, or a layout the phone zooms out). */
      phoneOverflowPx: number; consoleErrors: string[]; blockedRequests: string[];
      /** Phone layout: 390 when the page sets a phone viewport; wider (980) when it has no viewport meta tag. */
      phoneLayout?: { layoutWidth: number; contentWidth: number; scale: number };
      /** Keyboard focus measured by pressing Tab (up to 20 stops): tag names and booleans only. */
      focus?: { tabStops: number; visibleIndicators: number; complete: boolean; samples: { tag: string; visible: boolean; nav: boolean; faq: boolean }[] };
      /** Print media, measured only when the page has print CSS (@page or @media print); `checked: false` otherwise. */
      print?: PrintMeasurement;
    };
    artifacts: {
      metadata: components['schemas']['Artifact'];
      // Private originals are supplied to the trusted evaluator, never gallery clients.
      bytes: Uint8Array;
    }[];
    signal: AbortSignal;
  }): Promise<components['schemas']['QualificationResult']>;
}
