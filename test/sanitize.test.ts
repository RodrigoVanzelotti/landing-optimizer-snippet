import { describe, expect, it } from 'vitest';
import {
  isSafeSelector,
  looksLikePii,
  sanitizeProps,
  sanitizeHtml,
  truncate,
} from '../src/sanitize';

describe('looksLikePii', () => {
  it('detects emails, phones, cards, ssn', () => {
    expect(looksLikePii('reach me at a@b.com')).toBe(true);
    expect(looksLikePii('call +1 415 555 1234')).toBe(true);
    expect(looksLikePii('4111 1111 1111 1111')).toBe(true);
    expect(looksLikePii('123-45-6789')).toBe(true);
  });
  it('passes benign strings', () => {
    expect(looksLikePii('hello world')).toBe(false);
    expect(looksLikePii('plan: pro')).toBe(false);
  });
});

describe('sanitizeProps', () => {
  it('drops PII-shaped values and keeps safe primitives', () => {
    const out = sanitizeProps({
      plan: 'pro',
      seats: 5,
      active: true,
      email: 'user@example.com',
      nested: { drop: 'me' },
    });
    expect(out).toEqual({ plan: 'pro', seats: 5, active: true });
  });

  it('caps key count and string length', () => {
    const big: Record<string, unknown> = {};
    for (let i = 0; i < 50; i++) big['k' + i] = 'v';
    const out = sanitizeProps(big)!;
    expect(Object.keys(out).length).toBeLessThanOrEqual(20);
    expect(truncate('x'.repeat(1000), 256)).toHaveLength(256);
  });

  it('returns undefined for non-objects', () => {
    expect(sanitizeProps('nope')).toBeUndefined();
    expect(sanitizeProps(null)).toBeUndefined();
  });
});

describe('isSafeSelector', () => {
  it('accepts id/class/tag chains', () => {
    expect(isSafeSelector('#hero h1')).toBe(true);
    expect(isSafeSelector('.cta.primary')).toBe(true);
    expect(isSafeSelector('main > section > h2')).toBe(true);
  });
  it('rejects attribute-value and injection attempts', () => {
    expect(isSafeSelector('input[value="secret"]')).toBe(false);
    expect(isSafeSelector('a:hover')).toBe(false);
    expect(isSafeSelector('*{}</script>')).toBe(false);
    expect(isSafeSelector('')).toBe(false);
  });
});

describe('sanitizeHtml', () => {
  it('strips scripts and event handlers, keeps allowed inline tags', () => {
    const dirty = '<b>ok</b><img src=x onerror=alert(1)><script>alert(2)</script>';
    const clean = sanitizeHtml(dirty);
    expect(clean).toContain('<b>ok</b>');
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('<img');
  });
});
