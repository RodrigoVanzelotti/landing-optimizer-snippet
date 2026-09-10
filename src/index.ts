import { CAPTURE_PARAM, readConfig, sdkScriptSrc } from './config';
import {
  currentPath,
  detectBrowser,
  detectDevice,
  referrerHost,
  detectLanguage,
  viewportBucket,
} from './detect';
import { ExperimentEngine } from './experiments';
import { getSessionId } from './session';
import { Tracker } from './tracker';
import { Transport } from './transport';
import { sanitizeProps } from './sanitize';
import type { LandingOptimizerApi, SdkConfig, WireContext } from './types';

/**
 * SDK entry point. Everything is wrapped so that a failure here can never break
 * the host page: analytics and experiments are strictly best-effort.
 */
(function bootstrap(): void {
  try {
    const config = readConfig();
    if (!config) return; // missing/invalid install — do nothing, silently.

    // Must be resolved synchronously while document.currentScript is valid.
    const scriptSrc = sdkScriptSrc();

    if (Math.random() > config.sampling) {
      // Not sampled: still expose a no-op API so customer calls don't error.
      installNoopApi();
      return;
    }

    const sid = getSessionId();
    const device = detectDevice();

    const ctx = (): WireContext => ({
      path: currentPath(),
      ref: referrerHost(),
      dev: device,
      br: detectBrowser(),
      vp: viewportBucket(),
      lang: detectLanguage(),
    });

    const transport = new Transport(config, ctx, () => sid);
    transport.start();

    const tracker = new Tracker(transport);

    // Public API — replace the loader stub and drain any queued calls.
    const existing = window.LandingOptimizer;
    const api: LandingOptimizerApi = {
      track: (name, payload) => tracker.track(name, payload),
      conversion: (goal, payload) => tracker.conversion(goal, payload),
      identifyCompanyContext: (payload) => {
        // Non-PII business metadata only; sanitized and sent as a context event.
        const safe = sanitizeProps(payload);
        if (safe) tracker.track('company_context', safe);
      },
      _ready: true,
    };
    window.LandingOptimizer = api;
    drainQueue(existing, api);

    // Kick off tracking, then experiments (experiments are non-blocking).
    onReady(() => {
      try {
        tracker.init();
      } catch {
        /* best-effort */
      }
      const engine = new ExperimentEngine(config, sid, device, (exp, variant) =>
        tracker.exposure(exp, variant),
      );
      void engine.run();

      // Operator-only snapshot capture: lazy-load the separate capture bundle
      // when the page is opened with ?lo_capture=1. Real visitors never hit
      // this path, so the core bundle stays small.
      maybeLoadCapture(config, scriptSrc);
    });
  } catch {
    /* absolute last-resort guard: never throw into the host page */
  }
})();

function installNoopApi(): void {
  const noop: LandingOptimizerApi = {
    track: () => undefined,
    conversion: () => undefined,
    identifyCompanyContext: () => undefined,
    _ready: true,
  };
  window.LandingOptimizer = noop;
}

function drainQueue(
  existing: LandingOptimizerApi | undefined,
  api: LandingOptimizerApi,
): void {
  const queue = existing?.q;
  if (!Array.isArray(queue)) return;
  for (const call of queue) {
    try {
      const [method, args] = call as [keyof LandingOptimizerApi, unknown[]];
      const fn = api[method];
      if (typeof fn === 'function') {
        (fn as (...a: unknown[]) => void).apply(api, args ?? []);
      }
    } catch {
      /* skip malformed queued call */
    }
  }
}

/**
 * Load `lo-capture.js` (published next to `lo.js` on the CDN) and hand it the
 * runtime config. Guarded so a failure can never affect the host page.
 */
function maybeLoadCapture(config: SdkConfig, scriptSrc: string | null): void {
  try {
    if (new URLSearchParams(location.search).get(CAPTURE_PARAM) !== '1') return;
    if (!scriptSrc) return;
    const src = scriptSrc.replace(/lo(\.min)?\.js([?#].*)?$/, 'lo-capture.js');
    if (src === scriptSrc) return;
    const s = document.createElement('script');
    s.async = true;
    s.src = src;
    s.onload = () => {
      try {
        window.__loCapture?.(config);
      } catch {
        /* capture is best-effort */
      }
    };
    (document.head ?? document.documentElement).appendChild(s);
  } catch {
    /* never break the host page */
  }
}

function onReady(cb: () => void): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cb, { once: true });
  } else {
    cb();
  }
}
