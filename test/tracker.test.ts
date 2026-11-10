import { afterEach, expect, it, vi } from 'vitest';
import { Tracker } from '../src/tracker';
import type { Transport } from '../src/transport';
import type { WireEvent } from '../src/types';

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

it('uses manual identities for the map, nested CTA clicks, forms and section visibility', () => {
  vi.useFakeTimers();
  document.body.innerHTML = `
    <section data-lo-role="hero" data-lo-id="hero">
      <a href="/go" data-lo-role="cta" data-lo-id="hero-signup"><span>Começar</span></a>
      <button>Menu</button>
      <form data-lo-role="form" data-lo-id="signup-form"><input></form>
      <form id="unmarked"><input></form>
    </section>`;
  const handlers = new Map<string, EventListenerOrEventListenerObject>();
  vi.spyOn(document, 'addEventListener').mockImplementation((type, handler) => {
    handlers.set(type, handler);
  });
  vi.spyOn(window, 'addEventListener').mockImplementation(() => {});
  let intersect: IntersectionObserverCallback = () => {};
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback; }
    observe() {}
  });
  const events: WireEvent[] = [];
  new Tracker({ enqueue: (event: WireEvent) => events.push(event) } as unknown as Transport).init();
  const fire = (type: string, target: Element) => {
    (handlers.get(type) as EventListener)({ target } as unknown as Event);
  };
  fire('click', document.querySelector('span')!);
  fire('click', document.querySelector('button')!);
  expect(events.filter((e) => e.n === 'cta_click').map((e) => e.sel))
    .toEqual(['[data-lo-id="hero-signup"]']);
  fire('focusin', document.querySelector('input')!);
  fire('focusin', document.querySelector('input')!);
  fire('submit', document.querySelector('form')!);
  fire('focusin', document.querySelector('#unmarked input')!);
  fire('submit', document.querySelector('#unmarked')!);
  expect(events.filter((e) => e.n === 'form_start' || e.n === 'form_submit').map((e) => [e.n, e.sel]))
    .toEqual([
      ['form_start', '[data-lo-id="signup-form"]'],
      ['form_submit', '[data-lo-id="signup-form"]'],
    ]);
  intersect([{ target: document.querySelector('section')!, isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
  expect(events.find((e) => e.n === 'section_view')).toMatchObject({
    sec: 'hero', sel: '[data-lo-id="hero"]',
  });
  expect(events.find((e) => e.n === 'page_map')?.p?.nodes).toHaveLength(3);
});
