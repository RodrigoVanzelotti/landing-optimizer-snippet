import { afterEach, expect, it, vi } from 'vitest';
import { connectDataLayer } from '../src/global-events';

const host = window as Window & { dataLayer?: unknown[] };

afterEach(() => { delete host.dataLayer; });

it('relays configured purchase events from the initial queue and later pushes', () => {
  const old = { event: 'purchase', ecommerce: { transaction_id: 'order1', email: 'private@example.com' } };
  const layer: unknown[] = [old, { event: 'purchase' }, { event: 'checkout' }];
  host.dataLayer = layer;
  const emit = vi.fn();
  connectDataLayer({ source: 'purchase', goal: 'paid_order' }, emit);
  expect(layer.push(old, { event: 'purchase', transaction_id: 'order2', address: 'private' })).toBe(5);
  expect(emit.mock.calls).toEqual([['paid_order', 'order1'], ['paid_order', 'order2']]);
});
