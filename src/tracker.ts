import { LIMITS } from './config';
import { HoverTracker } from './hover';
import { detectCtas, buildPageMap, stableSelector } from './pagemap';
import type { PageMap } from './pagemap';
import { sanitizeProps } from './sanitize';
import type { Transport } from './transport';
import type { EventName, WireEvent } from './types';

/**
 * Wires up privacy-preserving behavioral listeners and exposes the public
 * track / conversion API. All handlers are defensive and never read form
 * values, password fields, or elements marked `data-lo-ignore`.
 */
export class Tracker {
  private navStart = Date.now();
  private scrollFired = new Set<number>();
  private clickTimes: number[] = [];
  private sectionSeen = new Set<Element>();

  constructor(private readonly transport: Transport) {}

  init(): void {
    this.emit('page_view');
    // Build the structural page map once and share it: section visibility,
    // hover attention, and the page_map event all read the same snapshot.
    const map = safeBuildPageMap();
    this.trackScrollDepth();
    this.trackClicks();
    this.trackForms();
    this.trackSectionVisibility(map);
    this.trackHover(map);
    this.trackDwell();
    this.sendPageMap(map);
  }

  /* ----------------------------- public API ----------------------------- */

  track(eventName: string, payload?: Record<string, unknown>): void {
    const name = String(eventName).slice(0, 64) as EventName;
    const p = sanitizeProps(payload);
    this.emit(name, p ? { p } : {});
  }

  conversion(goalName: string, payload?: Record<string, unknown>): void {
    const val = typeof payload?.['value'] === 'number' ? (payload['value'] as number) : 1;
    const extra: Partial<WireEvent> = { goal: String(goalName).slice(0, 64), val };
    const p = sanitizeProps(payload);
    if (p) extra.p = p;
    this.emit('conversion', extra);
  }

  exposure(experimentId: string, variantId: string): void {
    this.emit('exposure', { exp: experimentId, var: variantId });
  }

  /* --------------------------- internal helpers -------------------------- */

  private emit(n: EventName, extra: Partial<WireEvent> = {}): void {
    const event: WireEvent = { n, t: Date.now() - this.navStart, ...extra };
    this.transport.enqueue(event);
  }

  private trackScrollDepth(): void {
    const handler = (): void => {
      const doc = document.documentElement;
      const scrolled = window.scrollY + window.innerHeight;
      const height = Math.max(doc.scrollHeight, 1);
      const pct = Math.min(100, Math.round((scrolled / height) * 100));
      for (const b of LIMITS.scrollBuckets) {
        if (pct >= b && !this.scrollFired.has(b)) {
          this.scrollFired.add(b);
          this.emit('scroll_depth', { sd: b });
        }
      }
    };
    window.addEventListener('scroll', throttle(handler, 250), { passive: true });
  }

  private trackClicks(): void {
    const ctaSet = new Set(detectCtas());
    document.addEventListener(
      'click',
      (e) => {
        const target = e.target as Element | null;
        if (!target || this.isIgnored(target)) return;
        const el = target.closest('a,button,[role="button"],input');
        const now = Date.now();

        // Rage-click detection (rapid repeated clicks).
        this.clickTimes.push(now);
        this.clickTimes = this.clickTimes.filter(
          (t) => now - t < LIMITS.rageClickWindowMs,
        );
        if (this.clickTimes.length >= LIMITS.rageClickThreshold) {
          const sel = el ? stableSelector(el) : undefined;
          this.emit('rage_click', sel ? { sel } : {});
          this.clickTimes = [];
        }

        if (!el) {
          // Dead click: click that hits no interactive element.
          this.emit('dead_click', { sel: stableSelector(target) });
          return;
        }

        if (ctaSet.has(el) || el.tagName === 'BUTTON') {
          this.emit('cta_click', { sel: stableSelector(el) });
        }
      },
      { capture: true, passive: true },
    );
  }

  private trackForms(): void {
    // Never capture values — only lifecycle signals.
    document.addEventListener(
      'focusin',
      (e) => {
        const el = e.target as Element | null;
        if (!el || this.isIgnored(el)) return;
        const form = el.closest('form');
        if (form && !form.hasAttribute('data-lo-started')) {
          form.setAttribute('data-lo-started', '1');
          this.emit('form_start', { sel: stableSelector(form) });
        }
      },
      { capture: true },
    );
    document.addEventListener(
      'submit',
      (e) => {
        const form = e.target as Element | null;
        if (!form || this.isIgnored(form)) return;
        this.emit('form_submit', { sel: stableSelector(form) });
      },
      { capture: true },
    );
  }

  private trackSectionVisibility(map: PageMap): void {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !this.sectionSeen.has(entry.target)) {
            this.sectionSeen.add(entry.target);
            const node = map.nodes.find(
              (n) => safeMatch(entry.target, n.selector),
            );
            this.emit('section_view', { sec: node?.role ?? 'section' });
          }
        }
      },
      { threshold: 0.4 },
    );
    for (const node of map.nodes) {
      const el = safeQuery(node.selector);
      if (el) io.observe(el);
    }
  }

  private trackDwell(): void {
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.emit('dwell', { dw: LIMITS.dwellPingMs });
      }
    }, LIMITS.dwellPingMs);

    window.addEventListener('pagehide', () => {
      this.emit('dropoff', { dw: Date.now() - this.navStart });
    });
  }

  private trackHover(map: PageMap): void {
    try {
      const hover = new HoverTracker((entry) =>
        this.emit('hover', { sel: entry.sel, dw: entry.dw }),
      );
      hover.init(map.nodes);
    } catch {
      /* attention tracking is best-effort */
    }
  }

  private sendPageMap(map: PageMap): void {
    try {
      if (map.nodes.length === 0) return;
      this.emit('page_map', {
        p: { path: map.path, counts: map.counts, nodes: map.nodes.slice(0, 60) },
      });
    } catch {
      /* structural mapping is best-effort */
    }
  }

  private isIgnored(el: Element): boolean {
    if (el.closest('[data-lo-ignore]')) return true;
    const input = el.closest('input');
    if (input && input.getAttribute('type') === 'password') return true;
    return false;
  }
}

function safeBuildPageMap(): PageMap {
  try {
    return buildPageMap();
  } catch {
    return { path: location.pathname || '/', nodes: [], counts: {} };
  }
}

function throttle<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let last = 0;
  let scheduled: ReturnType<typeof setTimeout> | null = null;
  return function (this: unknown, ...args: never[]): void {
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      last = now;
      fn.apply(this, args);
    } else if (!scheduled) {
      scheduled = setTimeout(() => {
        last = Date.now();
        scheduled = null;
        fn.apply(this, args);
      }, remaining);
    }
  } as T;
}

function safeQuery(selector: string): Element | null {
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

function safeMatch(el: Element, selector: string): boolean {
  try {
    return el.matches(selector);
  } catch {
    return false;
  }
}
