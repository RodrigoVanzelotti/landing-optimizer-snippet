/**
 * Shared types for the Landing Optimizer SDK.
 * Kept intentionally small; the wire format matches docs/EVENT_SCHEMA.md.
 */

export type DeviceCategory = 'mobile' | 'tablet' | 'desktop';
export type BrowserCategory =
  | 'chromium'
  | 'firefox'
  | 'safari'
  | 'edge'
  | 'other';

export type EventName =
  | 'page_view'
  | 'scroll_depth'
  | 'cta_click'
  | 'dead_click'
  | 'rage_click'
  | 'form_start'
  | 'form_submit'
  | 'section_view'
  | 'dwell'
  | 'dropoff'
  | 'exposure'
  | 'conversion'
  | 'page_map';

/** A single event as sent on the wire (compact keys, see EVENT_SCHEMA §2). */
export interface WireEvent {
  n: EventName;
  t: number;
  sec?: string;
  sel?: string;
  sd?: number;
  dw?: number;
  exp?: string;
  var?: string;
  goal?: string;
  val?: number;
  p?: Record<string, unknown>;
}

export interface WireContext {
  path: string;
  ref: string;
  dev: DeviceCategory;
  br: BrowserCategory;
  vp: [number, number];
  lang: string;
}

export interface EventEnvelope {
  v: 1;
  siteId: string;
  ik: string;
  sid: string;
  sentAt: number;
  ctx: WireContext;
  events: WireEvent[];
}

/** Runtime configuration read from the loader script tag / global. */
export interface SdkConfig {
  siteId: string;
  ingestKey: string;
  ingestUrl: string;
  configUrl: string;
  /** base64 Ed25519 public key used to verify signed site config. */
  publicKey: string;
  /** 0..1 client sampling; server config can override. */
  sampling: number;
  debug: boolean;
}

/* -------------------------------------------------------------------------- */
/* Experiment / config types (mirror docs/EVENT_SCHEMA §7).                    */
/* -------------------------------------------------------------------------- */

export type ChangeOp =
  | 'set_text'
  | 'set_html_safe'
  | 'set_attr'
  | 'add_class'
  | 'remove_class'
  | 'hide'
  | 'show'
  | 'reorder';

export interface VariantChange {
  selector: string;
  op: ChangeOp;
  value?: string;
  attr?: string;
}

export interface ConfigVariant {
  id: string;
  weight: number;
  isControl: boolean;
  changes: VariantChange[];
}

export interface ExperimentTargeting {
  device?: DeviceCategory[];
  query?: Record<string, string>;
}

export interface ConfigExperiment {
  id: string;
  allocation: number;
  targeting?: ExperimentTargeting;
  variants: ConfigVariant[];
}

export interface SiteConfig {
  siteId: string;
  version: number;
  sampling: number;
  experiments: ConfigExperiment[];
  /** base64 Ed25519 signature over the canonical config minus `sig`. */
  sig: string;
}

/** Public window API surface. */
export interface LandingOptimizerApi {
  q?: unknown[][];
  track(eventName: string, payload?: Record<string, unknown>): void;
  identifyCompanyContext(payload: Record<string, unknown>): void;
  conversion(goalName: string, payload?: Record<string, unknown>): void;
  /** internal flag set once the full bundle has initialized. */
  _ready?: boolean;
}

declare global {
  interface Window {
    LandingOptimizer?: LandingOptimizerApi;
  }
}
