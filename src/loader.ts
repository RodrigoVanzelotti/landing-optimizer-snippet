/**
 * Tiny async loader. This is the canonical source for the inline stub that
 * customers paste (the API generates a minified, per-site copy). It:
 *   1. Installs a queueing stub API immediately so early calls are not lost.
 *   2. Injects the full SDK bundle (`lo.js`) asynchronously (never blocks).
 * Config is read from `window.__LO_CONFIG`.
 */
interface LoaderConfig {
  siteId: string;
  ingestKey: string;
  publicKey: string;
  sdkUrl: string;
  ingestUrl?: string;
  configUrl?: string;
  sampling?: number;
  debug?: boolean;
}

(function loader(w: Window & typeof globalThis, d: Document): void {
  try {
    const cfg = (w as unknown as { __LO_CONFIG?: LoaderConfig }).__LO_CONFIG;
    if (!cfg || !cfg.siteId || !cfg.ingestKey || !cfg.publicKey || !cfg.sdkUrl) {
      return;
    }

    // Queueing stub: preserves calls made before lo.js finishes loading.
    const existing = (w as unknown as { LandingOptimizer?: { q?: unknown[][] } })
      .LandingOptimizer;
    if (!existing || !existing.q) {
      const q: unknown[][] = existing?.q ?? [];
      const push = (m: string) =>
        function (...args: unknown[]): void {
          q.push([m, args]);
        };
      (w as unknown as { LandingOptimizer: unknown }).LandingOptimizer = {
        q,
        track: push('track'),
        conversion: push('conversion'),
        identifyCompanyContext: push('identifyCompanyContext'),
      };
    }

    const s = d.createElement('script');
    s.async = true;
    s.src = cfg.sdkUrl;
    s.setAttribute('data-site-id', cfg.siteId);
    s.setAttribute('data-ingest-key', cfg.ingestKey);
    s.setAttribute('data-public-key', cfg.publicKey);
    if (cfg.ingestUrl) s.setAttribute('data-ingest-url', cfg.ingestUrl);
    if (cfg.configUrl) s.setAttribute('data-config-url', cfg.configUrl);
    if (typeof cfg.sampling === 'number') s.setAttribute('data-sampling', String(cfg.sampling));
    if (cfg.debug) s.setAttribute('data-debug', 'true');
    s.crossOrigin = 'anonymous';

    const first = d.getElementsByTagName('script')[0];
    if (first && first.parentNode) first.parentNode.insertBefore(s, first);
    else (d.head || d.documentElement).appendChild(s);
  } catch {
    /* fail silently — must never break the host page */
  }
})(window, document);
