import { describe, expect, it, vi } from 'vitest';

import { collectNodeRects, snapshotUrlFrom } from '../src/capture';

describe('snapshotUrlFrom', () => {
  it('rewrites the standard events endpoint', () => {
    expect(snapshotUrlFrom('https://ingest.example.com/v1/events')).toBe(
      'https://ingest.example.com/v1/snapshots',
    );
  });

  it('handles a trailing slash', () => {
    expect(snapshotUrlFrom('http://localhost:3001/v1/events/')).toBe(
      'http://localhost:3001/v1/snapshots',
    );
  });

  it('falls back to origin-relative resolution for custom ingest URLs', () => {
    expect(snapshotUrlFrom('https://ingest.example.com/custom')).toBe(
      'https://ingest.example.com/v1/snapshots',
    );
  });
});

describe('collectNodeRects', () => {
  it('records document-space rects and skips invisible or missing nodes', () => {
    document.body.innerHTML =
      '<div id="hero">Hero</div><div id="hidden">Hidden</div>';

    const hero = document.getElementById('hero') as HTMLElement;
    vi.spyOn(hero, 'getBoundingClientRect').mockReturnValue({
      left: 10.4,
      top: 20.6,
      width: 300,
      height: 150,
      right: 310,
      bottom: 170,
      x: 10.4,
      y: 20.6,
      toJSON: () => ({}),
    } as DOMRect);
    // #hidden keeps jsdom's default zero-size rect and must be dropped.

    const rects = collectNodeRects([
      { selector: '#hero', role: 'hero' },
      { selector: '#hidden', role: 'section' },
      { selector: '#missing', role: 'cta' },
      { selector: ':::not-a-selector', role: 'cta' },
    ]);

    expect(rects).toEqual([
      { selector: '#hero', role: 'hero', rect: [10, 21, 300, 150] },
    ]);
  });
});
