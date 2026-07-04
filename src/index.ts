import { readConfig } from './config';
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
import type { LandingOptimizerApi, WireContext } from './types';

/**
 * SDK entry point. Everything is wrapped so that a failure here can never break
 * the host page: analytics and experiments are strictly best-effort.
 */
(function bootstrap(): void {
  try {
    const config = readConfig();
    if (!config) return; // missing/invalid install — do nothing, silently.

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

function onReady(cb: () => void): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cb, { once: true });
  } else {
    cb();
  }
}
