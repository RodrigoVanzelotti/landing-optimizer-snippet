import { describe, expect, it } from 'vitest';

import { LIMITS } from '../src/config';
import { HoverAggregator } from '../src/hover';

describe('HoverAggregator', () => {
  it('accumulates time per selector and drains largest-first', () => {
    const agg = new HoverAggregator();
    agg.add('#cta', 1000);
    agg.add('#hero', 3000);
    agg.add('#cta', 2000);

    const drained = agg.drain();
    expect(drained).toEqual([
      { sel: '#cta', dw: 3000 },
      { sel: '#hero', dw: 3000 },
    ]);
  });

  it('carries entries below the noise floor to the next drain', () => {
    const agg = new HoverAggregator();
    agg.add('#slow', LIMITS.hoverMinMs - 1000);
    expect(agg.drain()).toEqual([]);

    // The remainder plus new samples crosses the floor.
    agg.add('#slow', 1000);
    expect(agg.drain()).toEqual([{ sel: '#slow', dw: LIMITS.hoverMinMs }]);
  });

  it('resets drained entries so time is never double-counted', () => {
    const agg = new HoverAggregator();
    agg.add('#cta', LIMITS.hoverMinMs);
    expect(agg.drain()).toHaveLength(1);
    expect(agg.drain()).toEqual([]);
  });

  it('caps a drain to hoverMaxSelectors entries', () => {
    const agg = new HoverAggregator();
    for (let i = 0; i < LIMITS.hoverMaxSelectors + 5; i++) {
      agg.add(`#el-${i}`, LIMITS.hoverMinMs + i);
    }
    expect(agg.drain()).toHaveLength(LIMITS.hoverMaxSelectors);
  });

  it('ignores empty selectors and non-positive durations', () => {
    const agg = new HoverAggregator();
    agg.add('', 5000);
    agg.add('#x', 0);
    agg.add('#x', -100);
    agg.add('#x', Number.NaN);
    expect(agg.drain()).toEqual([]);
  });
});
