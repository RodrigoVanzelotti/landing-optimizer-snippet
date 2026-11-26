import { LIMITS } from './config';
import { ConfirmationTracker } from './confirmation';
import { currentPath } from './detect';
import { HoverTracker } from './hover';
import { detectCtas, buildPageMap, hasManualMapping, stableSelector } from './pagemap';
import type { PageMap } from './pagemap';
import { sanitizeProps } from './sanitize';
import type { Transport } from './transport';
import type { ConfirmationRule, EventName, WireEvent } from './types';

/**
 * Wires up privacy-preserving behavioral listeners and exposes the public
 * track / conversion API. All handlers are defensive and never read form
 * values, password fields, or elements marked `data-lo-ignore`.
 */
export class Tracker {
  private navStart: number;
  private path = currentPath();
  private scrollFired = new Set<number>();
  private clickTimes: number[] = [];
  private sectionSeen = new WeakSet<Element>();
  private formSeen = new WeakSet<Element>();
  private sectionObserver: IntersectionObserver | undefined;
  private ctas = new Set<Element>();
  private forms: Set<Element | null> | null = null;
  private mapPayload = '';
  private mapTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly hover = new HoverTracker(({ sel, dw }) => this.emit('hover', { sel, dw }));
  private readonly confirmations = new ConfirmationTracker((sel, formSelector) =>
    this.emit('element_visible', { sel, ...(formSelector ? { p: { formSelector } } : {}) }),
  );

  constructor(private readonly transport: Transport, private readonly startedAt = Date.now()) {
    this.navStart = startedAt;
  }

  init(): void {
    this.path = currentPath();
    this.emit('page_view');
    this.hover.init([]);
    this.refreshMap();
    this.trackScrollDepth();
    this.trackClicks();
    this.trackForms();
    this.trackDwell();
    this.trackNavigation();
    this.observeDom();
  }

  setConfirmationRules(rules: ConfirmationRule[]): void {
    this.confirmations.setRules(rules);
  }

  private refreshMap(): void {
    const map = safeBuildPageMap();
    this.ctas = new Set(detectCtas());
    this.forms = hasManualMapping()
      ? new Set(map.nodes.filter((node) => node.role === 'form').map((node) => safeQuery(node.selector)))
      : null;
    this.trackSectionVisibility(map);
    this.hover.setNodes(map.nodes);
    this.sendPageMap(map);
  }

  private scheduleMap(): void {
    if (this.mapTimer !== undefined) return;
    this.mapTimer = setTimeout(() => {
      this.mapTimer = undefined;
      this.refreshMap();
    }, 100);
  }

  private trackNavigation(): void {
    const check = (): void => {
      const next = currentPath();
      if (next === this.path) return;
      this.hover.flush();
      this.hover.setNodes([]);
      this.sectionObserver?.disconnect();
      this.sectionObserver = undefined;
      this.path = next;
      this.navStart = Date.now();
      this.mapPayload = '';
      this.ctas.clear();
      this.forms = hasManualMapping() ? new Set() : null;
      this.formSeen = new WeakSet();
      this.sectionSeen = new WeakSet();
      this.scrollFired.clear();
      this.clickTimes = [];
      this.confirmations.reset();
      this.emit('page_view');
      this.scheduleMap();
    };
    window.addEventListener('popstate', check);
    for (const method of ['pushState', 'replaceState'] as const) {
      const original = history[method];
      history[method] = function (...args: Parameters<History[typeof method]>): void {
        original.apply(this, args);
        try { check(); } catch { /* tracking must not break navigation */ }
      };
    }
  }

  private observeDom(): void {
    if (typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver((mutations) => {
      this.confirmations.check();
      if (mutations.some((mutation) =>
        mutation.attributeName?.startsWith('data-lo-') ||
        [...mutation.addedNodes, ...mutation.removedNodes].some((node) => node.nodeType === 1),
      )) this.scheduleMap();
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['hidden', 'aria-hidden', 'class', 'style', 'open', 'data-lo-id', 'data-lo-role', 'data-lo-ignore'],
    });
    document.addEventListener('transitionend', () => this.confirmations.check(), { capture: true });
    document.addEventListener('animationend', () => this.confirmations.check(), { capture: true });
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
    const event: WireEvent = { n, t: Date.now() - this.startedAt, ...extra };
    this.transport.enqueue(event, this.path);
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
    document.addEventListener(
      'click',
      (e) => {
        const target = e.target as Element | null;
        if (!target || this.isIgnored(target)) return;
        const el = target.closest('a,button,[role="button"],input,[data-lo-role="cta"]');
        if (el && e.isTrusted) this.confirmations.arm(this.path);
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

        if (this.ctas.has(el) || (this.forms === null && el.tagName === 'BUTTON')) {
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
        if (form && (!this.forms || this.forms.has(form)) && !this.formSeen.has(form)) {
          this.formSeen.add(form);
          this.emit('form_start', { sel: stableSelector(form) });
        }
      },
      { capture: true },
    );
    document.addEventListener(
      'submit',
      (e) => {
        const form = e.target;
        if (!(form instanceof HTMLFormElement) || this.isIgnored(form)) return;
        const sel = stableSelector(form);
        this.confirmations.arm(this.path, sel);
        if (!this.forms || this.forms.has(form)) this.emit('form_submit', { sel });
      },
      { capture: true },
    );
  }

  private trackSectionVisibility(map: PageMap): void {
    this.sectionObserver?.disconnect();
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (this.sectionObserver !== io) return;
        for (const entry of entries) {
          if (entry.isIntersecting && !this.sectionSeen.has(entry.target)) {
            this.sectionSeen.add(entry.target);
            const node = map.nodes.find(
              (n) => safeMatch(entry.target, n.selector),
            );
            this.emit('section_view', {
              sec: node?.role ?? 'section', sel: node?.selector ?? stableSelector(entry.target),
            });
          }
        }
      },
      { threshold: 0.4 },
    );
    this.sectionObserver = io;
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

  private sendPageMap(map: PageMap): void {
    try {
      if (map.nodes.length === 0) return;
      const payload = { path: map.path, counts: map.counts, nodes: map.nodes.slice(0, 60) };
      const serialized = JSON.stringify(payload);
      if (serialized === this.mapPayload) return;
      this.mapPayload = serialized;
      this.emit('page_map', { p: payload });
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
