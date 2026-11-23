import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ExperimentEngine } from '../src/experiments';
import type { SdkConfig } from '../src/types';

const config: SdkConfig = { siteId: 'site', ingestKey: 'key', publicKey: 'eA==', ingestUrl: '/events', configUrl: '/config', sampling: 0, debug: false };
const verify = vi.fn();
beforeEach(() => {
  document.body.innerHTML = '<h1>Base</h1><p>Original</p>';
  verify.mockResolvedValue(true);
  vi.stubGlobal('crypto', { subtle: { importKey: vi.fn().mockResolvedValue({}), verify } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ siteId: 'site', version: 1, sig: 'eA==', experiments: [
    { id: 'accepted', permanent: true, allocation: 1, variants: [{ id: 'kept', weight: 1, isControl: false, changes: [{ selector: 'h1', op: 'set_text', value: 'Accepted' }] }] },
    { id: 'running', allocation: 1, variants: [{ id: 'candidate', weight: 1, isControl: false, changes: [{ selector: 'p', op: 'set_text', value: 'Test' }] }] },
  ] }) }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('applies only signed permanent changes outside the analytics sample', async () => {
  const exposure = vi.fn();
  await new ExperimentEngine(config, '', 'desktop', exposure).run(true);
  expect(document.querySelector('h1')?.textContent).toBe('Accepted');
  expect(document.querySelector('p')?.textContent).toBe('Original');
  expect(exposure).toHaveBeenCalledTimes(1);
  expect(exposure).toHaveBeenCalledWith('accepted', 'kept');
});
it('preserves the normal experiment flow for sampled sessions', async () => {
  await new ExperimentEngine(config, 'session', 'desktop', vi.fn()).run();
  expect(document.querySelector('p')?.textContent).toBe('Test');
});
it('never applies an untrusted permanent configuration', async () => {
  verify.mockResolvedValue(false);
  await new ExperimentEngine(config, '', 'desktop', vi.fn()).run(true);
  expect(document.querySelector('h1')?.textContent).toBe('Base');
});
