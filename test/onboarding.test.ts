import { afterEach, expect, it, vi } from 'vitest';
import { Tracker } from '../src/tracker';
import { Transport } from '../src/transport';
import type { EventEnvelope, SdkConfig } from '../src/types';

const config: SdkConfig = {
  siteId: 'test', ingestKey: 'test', publicKey: 'test', ingestUrl: '/events',
  configUrl: '/config', sampling: 1, debug: false,
};
const pushState = history.pushState;
const replaceState = history.replaceState;

afterEach(() => {
  history.pushState = pushState;
  history.replaceState = replaceState;
  history.replaceState(null, '', '/');
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

it('tracks a late-mounted SPA form and sends one matching confirmation with the correct session and path', async () => {
  vi.useFakeTimers();
  document.body.innerHTML = '<a data-lo-role="cta" data-lo-id="signup" href="/signup">Sign up</a>';
  const envelopes: EventEnvelope[] = [];
  vi.stubGlobal('fetch', (_: string, init: RequestInit) => {
    envelopes.push(JSON.parse(init.body as string) as EventEnvelope);
    return Promise.resolve(new Response(null, { status: 202 }));
  });

  const transport = new Transport(config, () => ({
    path: location.pathname, ref: '', dev: 'desktop', br: 'other', vp: [1440, 900], lang: 'en',
  }), () => 'test-session', Date.now());
  const tracker = new Tracker(transport);
  tracker.init();
  tracker.setConfirmationRules([{
    path: '/signup', selector: '[data-lo-id="signup-done"]', formSelector: '[data-lo-id="signup-form"]',
  }]);
  tracker.exposure('experiment', 'variant');
  history.pushState(null, '', '/signup');
  history.replaceState(null, '', '/signup?source=example');
  vi.advanceTimersByTime(110);
  document.body.innerHTML = `
    <form data-lo-role="form" data-lo-id="signup-form"></form>
    <form id="other-form"></form>
    <p id="error" hidden>Try again</p>
    <p data-lo-id="signup-done" hidden>Success</p>`;
  const form = document.querySelector('form')!;
  const success = document.querySelector('[data-lo-id="signup-done"]')!;
  Object.defineProperty(success, 'checkVisibility', { value: () => true });
  await vi.advanceTimersByTimeAsync(110);
  const submit = (target: Element) => target.dispatchEvent(new Event('submit', { bubbles: true }));
  submit(document.querySelector('#other-form')!);
  success.removeAttribute('hidden');
  await Promise.resolve();
  submit(form);
  await Promise.resolve();
  success.setAttribute('hidden', '');
  await Promise.resolve();
  submit(form);
  document.querySelector('#error')!.removeAttribute('hidden');
  await Promise.resolve();
  transport.flush();
  expect(envelopes.flatMap(envelope => envelope.events).filter(event => event.n === 'element_visible')).toEqual([]);

  success.removeAttribute('hidden');
  await Promise.resolve();
  success.classList.add('redrawn');
  await Promise.resolve();
  transport.flush();

  expect(envelopes.flatMap(envelope =>
    envelope.events.filter(event => event.n === 'page_view').map(() => envelope.ctx.path),
  )).toEqual(['/', '/signup']);
  expect(envelopes.find(envelope => envelope.ctx.path === '/signup')?.events[0])
    .toMatchObject({ n: 'page_view', p: { previousPath: '/' } });
  expect(envelopes.find(envelope => envelope.events.some(event => event.n === 'exposure'))).toMatchObject({
    sid: 'test-session', ctx: { path: '/' },
  });
  const signals = envelopes.flatMap(envelope =>
    envelope.events.filter(event => event.n === 'element_visible').map(event => ({ envelope, event })),
  );
  expect(signals).toHaveLength(1);
  expect(signals[0]).toMatchObject({
    envelope: { sid: 'test-session', ctx: { path: '/signup' } },
    event: { sel: '[data-lo-id="signup-done"]', p: { formSelector: '[data-lo-id="signup-form"]' } },
  });
  expect(envelopes.flatMap(envelope => envelope.events).filter(event => event.n === 'form_submit')).toHaveLength(2);
  expect(envelopes.flatMap(envelope => envelope.events).some(event =>
    event.n === 'page_map' && event.p?.path === '/signup' &&
    JSON.stringify(event.p.nodes).includes('signup-form'),
  )).toBe(true);
});
