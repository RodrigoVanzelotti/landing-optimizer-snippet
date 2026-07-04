import type { SdkConfig } from './types';

const DEFAULT_INGEST_URL = 'https://ingest.landingoptimizer.io/v1/events';
const DEFAULT_CONFIG_URL = 'https://cdn.landingoptimizer.io/v1/config';

/**
 * Read runtime configuration from the currently executing script tag's
 * `data-*` attributes, falling back to a `window.__LO_CONFIG` object if present.
 * Never throws — returns null if the required fields are missing so the caller
 * can fail silently.
 */
export function readConfig(): SdkConfig | null {
  try {
    const el = currentScript();
    const ds = el?.dataset ?? {};
    const injected = (window as unknown as { __LO_CONFIG?: Partial<SdkConfig> })
      .__LO_CONFIG;

    const siteId = ds['siteId'] ?? injected?.siteId;
    const ingestKey = ds['ingestKey'] ?? injected?.ingestKey;
    const publicKey = ds['publicKey'] ?? injected?.publicKey;

    if (!siteId || !ingestKey || !publicKey) return null;

    const sampling = clamp01(
      parseFloat(ds['sampling'] ?? String(injected?.sampling ?? '1')),
    );

    return {
      siteId,
      ingestKey,
      publicKey,
      ingestUrl: ds['ingestUrl'] ?? injected?.ingestUrl ?? DEFAULT_INGEST_URL,
      configUrl: ds['configUrl'] ?? injected?.configUrl ?? DEFAULT_CONFIG_URL,
      sampling: Number.isFinite(sampling) ? sampling : 1,
      debug: (ds['debug'] ?? '') === 'true' || injected?.debug === true,
    };
  } catch {
    return null;
  }
}

function currentScript(): HTMLScriptElement | null {
  const cs = document.currentScript;
  if (cs instanceof HTMLScriptElement) return cs;
  // Fallback: last script tag referencing our bundle.
  const scripts = document.getElementsByTagName('script');
  for (let i = scripts.length - 1; i >= 0; i--) {
    const s = scripts[i];
    if (s && /lo(\.min)?\.js/.test(s.src)) return s;
  }
  return null;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(1, n));
}

/** Batch/timing constants (privacy-preserving, low overhead). */
export const LIMITS = {
  batchMaxEvents: 50,
  flushIntervalMs: 4000,
  maxPropKeys: 20,
  maxStringLen: 256,
  rageClickWindowMs: 800,
  rageClickThreshold: 3,
  dwellPingMs: 10000,
  scrollBuckets: [25, 50, 75, 100] as const,
  sessionTtlMs: 30 * 60 * 1000, // 30 minutes, short-lived
  configTimeoutMs: 2500,
  antiFlickerMaxMs: 2000,
} as const;
