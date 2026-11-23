import { afterEach, expect, it, vi } from 'vitest';
import { ExperimentEngine } from '../src/experiments';
import { getSessionId } from '../src/session';
import { Tracker } from '../src/tracker';
import { Transport } from '../src/transport';

const state = vi.hoisted(() => ({ run: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../src/config', () => ({ CAPTURE_PARAM: 'lo_capture', sdkScriptSrc: () => '', readConfig: () => ({ sampling: 0 }) }));
vi.mock('../src/experiments', () => ({ ExperimentEngine: vi.fn().mockImplementation(function () { return { run: state.run }; }) }));
vi.mock('../src/session', () => ({ getSessionId: vi.fn() }));
vi.mock('../src/tracker', () => ({ Tracker: vi.fn() }));
vi.mock('../src/transport', () => ({ Transport: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); });
it.each([0, .5])('keeps tracking disabled at sampling zero, including random=%s, without creating a session ID', async random => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.spyOn(Math, 'random').mockReturnValue(random);
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
  await import('../src/index');
  expect(ExperimentEngine).toHaveBeenCalledWith(expect.anything(), '', expect.anything(), expect.any(Function));
  expect(state.run).toHaveBeenCalledTimes(1);
  expect(state.run).toHaveBeenCalledWith(true);
  expect(getSessionId).not.toHaveBeenCalled(); expect(Tracker).not.toHaveBeenCalled(); expect(Transport).not.toHaveBeenCalled();
  expect(() => window.LandingOptimizer?.conversion('lead')).not.toThrow();
});
