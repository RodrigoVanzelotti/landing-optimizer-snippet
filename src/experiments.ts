import { LIMITS } from './config';
import { hash32 } from './pagemap';
import { isSafeSelector, sanitizeHtml, truncate } from './sanitize';
import type {
  ConfigExperiment,
  ConfigVariant,
  DeviceCategory,
  SdkConfig,
  SiteConfig,
  VariantChange,
} from './types';

/**
 * Fetches signed site config, verifies its Ed25519 signature, allocates the
 * visitor to variants deterministically (sticky by session id), and applies
 * safe DOM changes. If anything is off — bad signature, unsupported crypto,
 * fetch failure — experiments are simply NOT applied (analytics still runs).
 */
export class ExperimentEngine {
  private applied = new Set<string>();

  constructor(
    private readonly config: SdkConfig,
    private readonly sid: string,
    private readonly device: DeviceCategory,
    private readonly onExposure: (experimentId: string, variantId: string) => void,
  ) {}

  async run(): Promise<void> {
    const site = await this.fetchConfig();
    if (!site) return;
    const ok = await verifySignature(this.config.publicKey, site);
    if (!ok) {
      this.debug('config signature invalid — experiments skipped');
      return;
    }
    for (const exp of site.experiments) {
      try {
        this.evaluate(exp);
      } catch {
        /* one bad experiment must not break the others or the page */
      }
    }
  }

  private async fetchConfig(): Promise<SiteConfig | null> {
    const url = `${this.config.configUrl}/${encodeURIComponent(this.config.siteId)}`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), LIMITS.configTimeoutMs);
    try {
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'omit',
        mode: 'cors',
        signal: controller.signal,
      });
      if (!res.ok) return null;
      return (await res.json()) as SiteConfig;
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  private evaluate(exp: ConfigExperiment): void {
    if (!this.matchesTargeting(exp)) return;

    // Is the visitor in the experiment at all?
    const inExp = bucket(`${this.sid}:${exp.id}`) < clamp01(exp.allocation);
    if (!inExp) return;

    const variant = this.pickVariant(exp);
    if (!variant) return;

    this.applyVariant(exp, variant);
  }

  private matchesTargeting(exp: ConfigExperiment): boolean {
    const t = exp.targeting;
    if (!t) return true;
    if (t.device && t.device.length && !t.device.includes(this.device)) return false;
    if (t.query) {
      const params = new URLSearchParams(location.search);
      for (const [k, v] of Object.entries(t.query)) {
        if (params.get(k) !== v) return false;
      }
    }
    return true;
  }

  private pickVariant(exp: ConfigExperiment): ConfigVariant | null {
    const variants = exp.variants.filter((v) => v.weight > 0);
    if (variants.length === 0) return null;
    const total = variants.reduce((s, v) => s + v.weight, 0);
    const r = bucket(`${this.sid}:${exp.id}:variant`) * total;
    let acc = 0;
    for (const v of variants) {
      acc += v.weight;
      if (r <= acc) return v;
    }
    return variants[variants.length - 1] ?? null;
  }

  private applyVariant(exp: ConfigExperiment, variant: ConfigVariant): void {
    const key = `${exp.id}:${variant.id}`;
    if (this.applied.has(key)) return;
    this.applied.add(key);

    const apply = (): boolean => {
      let anyApplied = false;
      for (const change of variant.changes) {
        if (applyChange(change)) anyApplied = true;
      }
      return anyApplied || variant.isControl;
    };

    // Try now; if target elements are not present yet (SPA/late render),
    // observe the DOM briefly up to the anti-flicker bound.
    const done = apply();
    if (done || variant.isControl) {
      this.onExposure(exp.id, variant.id);
      return;
    }

    const deadline = Date.now() + LIMITS.antiFlickerMaxMs;
    const observer = new MutationObserver(() => {
      if (apply() || Date.now() > deadline) {
        observer.disconnect();
        this.onExposure(exp.id, variant.id);
      }
    });
    try {
      observer.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        this.onExposure(exp.id, variant.id);
      }, LIMITS.antiFlickerMaxMs);
    } catch {
      this.onExposure(exp.id, variant.id);
    }
  }

  private debug(msg: string): void {
    if (this.config.debug) console.info('[LandingOptimizer]', msg);
  }
}

/** Apply a single change; returns true if at least one element was affected. */
export function applyChange(change: VariantChange): boolean {
  if (!isSafeSelector(change.selector)) return false;
  let els: NodeListOf<Element>;
  try {
    els = document.querySelectorAll(change.selector);
  } catch {
    return false;
  }
  if (els.length === 0) return false;

  els.forEach((el) => {
    switch (change.op) {
      case 'set_text':
        el.textContent = truncate(change.value ?? '', 2000);
        break;
      case 'set_html_safe':
        el.innerHTML = sanitizeHtml(change.value ?? '');
        break;
      case 'set_attr':
        if (change.attr && isSafeAttr(change.attr)) {
          el.setAttribute(change.attr, truncate(change.value ?? '', 1000));
        }
        break;
      case 'add_class':
        if (change.value) el.classList.add(...safeClasses(change.value));
        break;
      case 'remove_class':
        if (change.value) el.classList.remove(...safeClasses(change.value));
        break;
      case 'hide':
        (el as HTMLElement).style.setProperty('display', 'none', 'important');
        break;
      case 'show':
        (el as HTMLElement).style.removeProperty('display');
        break;
      case 'reorder':
        reorder(el, change.value);
        break;
      default:
        break;
    }
  });
  return true;
}

function reorder(el: Element, order?: string): void {
  // `value` is a space/comma separated list of child indices, e.g. "2,0,1".
  if (!order) return;
  const idx = order
    .split(/[\s,]+/)
    .map((n) => parseInt(n, 10))
    .filter((n) => Number.isInteger(n));
  const children = Array.from(el.children);
  if (idx.length !== children.length) return;
  const frag = document.createDocumentFragment();
  for (const i of idx) {
    const child = children[i];
    if (child) frag.appendChild(child);
  }
  el.appendChild(frag);
}

const SAFE_ATTRS = new Set(['title', 'aria-label', 'alt', 'placeholder', 'data-lo-variant']);
function isSafeAttr(attr: string): boolean {
  const a = attr.toLowerCase();
  if (a.startsWith('on')) return false;
  if (a === 'href' || a === 'src' || a === 'style') return false;
  return SAFE_ATTRS.has(a) || a.startsWith('data-lo-');
}

function safeClasses(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .filter((c) => /^[a-zA-Z][\w-]*$/.test(c))
    .slice(0, 10);
}

/** Deterministic 0..1 bucket from a string (stable for a given session). */
export function bucket(seed: string): number {
  return hash32(seed) / 0xffffffff;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/* -------------------------------------------------------------------------- */
/* Ed25519 signature verification via Web Crypto (fail-safe if unsupported).   */
/* -------------------------------------------------------------------------- */

export async function verifySignature(
  publicKeyB64: string,
  config: SiteConfig,
): Promise<boolean> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return false;

    const keyBytes = base64ToBytes(publicKeyB64);
    const sigBytes = base64ToBytes(config.sig);
    const { sig, ...unsigned } = config;
    void sig;
    const data = new TextEncoder().encode(canonicalJson(unsigned));

    const key = await subtle.importKey('raw', keyBytes, { name: 'Ed25519' }, false, [
      'verify',
    ]);
    return await subtle.verify('Ed25519', key, sigBytes, data);
  } catch {
    // Unsupported algorithm or malformed input → do not trust the config.
    return false;
  }
}

/**
 * Deterministic JSON with recursively sorted object keys. The API MUST sign the
 * output of the identical canonicalization to keep signatures verifiable.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return `{${entries.join(',')}}`;
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
