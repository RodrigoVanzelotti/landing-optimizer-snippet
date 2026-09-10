import { LIMITS } from './config';
import type { MappedNode } from './pagemap';

/**
 * Element-anchored hover ("attention") tracking. The pointer position is
 * sampled at a low, fixed rate (1 Hz) and resolved to the nearest mapped
 * page-map element. Time is accumulated per selector locally and flushed as a
 * small number of aggregate `hover` events — raw pointer coordinates never
 * leave the browser, keeping the payload tiny and privacy-preserving.
 *
 * Only pointer devices produce samples, so touch-only visitors add zero cost.
 */

export interface HoverEntry {
  sel: string;
  dw: number;
}

/** Pure accumulator, separated from DOM wiring so it is unit-testable. */
export class HoverAggregator {
  private totals = new Map<string, number>();

  add(selector: string, ms: number): void {
    if (!selector || !Number.isFinite(ms) || ms <= 0) return;
    this.totals.set(selector, (this.totals.get(selector) ?? 0) + ms);
  }

  /**
   * Returns aggregated entries above the noise floor, largest first, capped to
   * `hoverMaxSelectors`, and resets the accumulator. Entries below the floor
   * are carried over so slow accumulation on one element is not lost.
   */
  drain(): HoverEntry[] {
    const ready: HoverEntry[] = [];
    const carry = new Map<string, number>();
    for (const [sel, dw] of this.totals) {
      if (dw >= LIMITS.hoverMinMs) ready.push({ sel, dw });
      else carry.set(sel, dw);
    }
    ready.sort((a, b) => b.dw - a.dw);
    this.totals = carry;
    return ready.slice(0, LIMITS.hoverMaxSelectors);
  }
}

export class HoverTracker {
  private readonly aggregator = new HoverAggregator();
  private elementToSelector = new Map<Element, string>();
  private lastX = -1;
  private lastY = -1;
  private hasPointer = false;

  constructor(private readonly emit: (entry: HoverEntry) => void) {}

  /** Wire listeners. `nodes` is the already-built page map for this page. */
  init(nodes: MappedNode[]): void {
    this.indexNodes(nodes);
    if (this.elementToSelector.size === 0) return;

    document.addEventListener(
      'mousemove',
      (e) => {
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.hasPointer = true;
      },
      { passive: true, capture: true },
    );

    setInterval(() => this.sample(), LIMITS.hoverSampleMs);
    setInterval(() => this.flush(), LIMITS.hoverFlushMs);
    window.addEventListener('pagehide', () => this.flush());
  }

  private indexNodes(nodes: MappedNode[]): void {
    for (const node of nodes) {
      const el = safeQuery(node.selector);
      if (el && !this.elementToSelector.has(el)) {
        this.elementToSelector.set(el, node.selector);
      }
    }
  }

  private sample(): void {
    try {
      if (!this.hasPointer || document.visibilityState !== 'visible') return;
      const el = document.elementFromPoint(this.lastX, this.lastY);
      if (!el || el.closest('[data-lo-ignore]')) return;
      const selector = this.resolve(el);
      if (selector) this.aggregator.add(selector, LIMITS.hoverSampleMs);
    } catch {
      /* attention sampling is best-effort */
    }
  }

  /** Walk up from the hovered element to the nearest mapped ancestor. */
  private resolve(el: Element): string | null {
    let node: Element | null = el;
    while (node) {
      const selector = this.elementToSelector.get(node);
      if (selector) return selector;
      node = node.parentElement;
    }
    return null;
  }

  private flush(): void {
    for (const entry of this.aggregator.drain()) this.emit(entry);
  }
}

function safeQuery(selector: string): Element | null {
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}
